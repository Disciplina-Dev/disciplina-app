import { TodoRepository } from '../repositories/mysql/TodoRepository';
import { TodoGroupRepository } from '../repositories/mysql/TodoGroupRepository';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { Todo, TodoRow, CreateTodoInput, UpdateTodoInput, TodoGroup, TodoGroupRow } from '../types/todo.types';
import { NotificationService } from './NotificationService';
import { logger } from '../external/logger';

const RELANCE_REF_PREFIX = 'relance:';

function toTodo(row: TodoRow): Todo {
    return {
        id: row.id,
        userId: row.user_id,
        assignedBy: row.assigned_by ?? null,
        title: row.title,
        description: row.description,
        deadline: row.deadline,
        position: row.position,
        status: row.status,
        source: row.source,
        sourceRef: row.source_ref,
        groupId: row.group_id ?? null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function toTodoGroup(row: TodoGroupRow): TodoGroup {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

export class TodoService {
    private repo = new TodoRepository();
    private groupRepo = new TodoGroupRepository();
    private companyRepo = new CompanyRepository();
    private userRepo = new UserRepository();
    private notificationService = new NotificationService();

    async listForUser(userId: number): Promise<Todo[]> {
        await this.syncRelanceTodos(userId);
        // Cleanup orphan groups that may have been left behind by stale SYSTEM todos sweep
        await this.groupRepo.deleteOrphansForUser(userId);
        const rows = await this.repo.findByUser(userId);
        return rows.map(toTodo);
    }

    /**
     * Sweep run on todo-list load: one SYSTEM todo per (company, relanceDate) due
     * today or earlier, keyed by source_ref "relance:<companyId>:<date>". A todo
     * deleted by the user stays soft-deleted (never recreated for the same date);
     * when the relance date changes or is cleared, stale non-DONE todos are removed.
     */
    private async syncRelanceTodos(userId: number): Promise<void> {
        const due = await this.companyRepo.findDueRelancesByUser(userId);
        const validRefs = due.map((c) => `${RELANCE_REF_PREFIX}${c.id}:${c.relance_date}`);

        await this.repo.deleteStaleSystemTodos(userId, RELANCE_REF_PREFIX, validRefs);

        const existing = new Set(await this.repo.findSourceRefsByPrefix(userId, RELANCE_REF_PREFIX));
        // Sequential: create() computes MAX(position) per insert.
        for (const [i, c] of due.entries()) {
            const ref = validRefs[i];
            if (!existing.has(ref)) await this.createSystemTodo(userId, `Relancer ${c.name}`, ref);
        }
    }

    async create(assignerId: number, input: CreateTodoInput): Promise<Todo> {
        const assigneeId = input.assignedTo ?? assignerId;
        if (assigneeId !== assignerId) {
            const assignee = await this.userRepo.findById(assigneeId);
            if (!assignee) throw new Error('Assigned user not found');
            await this.notifyAssigned(assignerId, assigneeId, input.title);
        }

        const resolvedGroupId = await this.resolveGroupForCreate(assigneeId, input);

        const createInput: CreateTodoInput = { ...input, groupId: resolvedGroupId };
        // groupName is not a column, remove before insert
        delete (createInput as any).groupName;

        const id = await this.repo.create(assigneeId, createInput, 'MANUAL', undefined, assignerId);
        const row = await this.repo.findById(id, assigneeId);
        if (!row) throw new Error('Failed to retrieve created todo');
        return toTodo(row);
    }

    private async resolveGroupForCreate(assigneeId: number, input: CreateTodoInput): Promise<number | null> {
        if (input.groupId != null && input.groupName) {
            throw new Error('Provide either groupId or groupName, not both');
        }
        if (input.groupId != null) {
            const group = await this.groupRepo.findById(input.groupId);
            if (!group) throw new Error('Group not found');
            if (group.user_id !== assigneeId) throw new Error('Group does not belong to the assignee');
            return group.id;
        }
        if (input.groupName) {
            const name = input.groupName.trim();
            if (!name) throw new Error('Group name cannot be empty');
            if (name.length > 100) throw new Error('Group name too long');
            const existing = await this.groupRepo.findByName(assigneeId, name);
            if (existing) return existing.id;
            return this.groupRepo.create(assigneeId, name);
        }
        return null;
    }

    async listGroupsForUser(userId: number): Promise<TodoGroup[]> {
        const rows = await this.groupRepo.findByUser(userId);
        return rows.map(toTodoGroup);
    }

    async createGroup(userId: number, name: string): Promise<TodoGroup> {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Group name cannot be empty');
        if (trimmed.length > 100) throw new Error('Group name too long');
        const existing = await this.groupRepo.findByName(userId, trimmed);
        if (existing) return toTodoGroup(existing);
        const id = await this.groupRepo.create(userId, trimmed);
        const row = await this.groupRepo.findById(id);
        if (!row) throw new Error('Failed to create group');
        return toTodoGroup(row);
    }

    async createGroupForAssignee(requesterId: number, targetUserId: number, name: string): Promise<TodoGroup> {
        // Any authenticated user can create a group for another user when assigning a task.
        // Verify target user exists.
        const target = await this.userRepo.findById(targetUserId);
        if (!target) throw new Error('Target user not found');
        return this.createGroup(targetUserId, name);
    }

    /** Notifie le destinataire qu'une tâche lui a été assignée (persistée + push SSE). */
    private async notifyAssigned(assignerId: number, assigneeId: number, title: string): Promise<void> {
        try {
            const [assigner, assignee] = await Promise.all([
                this.userRepo.findById(assignerId),
                this.userRepo.findById(assigneeId),
            ]);
            const assignerName = assigner ? `${assigner.first_name} ${assigner.last_name}` : undefined;
            const link =
                assignee?.role_name === 'COMMERCIAL'
                    ? '/commercial/todos'
                    : assignee?.role_name === 'RH'
                      ? '/rh/todos'
                      : undefined;
            await this.notificationService.create({
                userId: assigneeId,
                type: 'todo_assigned',
                category: 'company',
                level: 'info',
                title: 'Nouvelle tâche',
                message: assignerName ? `« ${title} » assignée par ${assignerName}` : `« ${title} » a été ajoutée à vos tâches`,
                link,
            });
        } catch (err) {
            logger.error({ err }, 'Failed to notify task assignee');
        }
    }

    /** Called by system processes (e.g. AB signed). Never exposed via public mutation. */
    async createSystemTodo(userId: number, title: string, sourceRef: string): Promise<void> {
        await this.repo.create(userId, { title }, 'SYSTEM', sourceRef);
    }

    async update(userId: number, id: number, input: UpdateTodoInput): Promise<Todo> {
        const existing = await this.repo.findById(id, userId);
        if (!existing) throw new Error('Todo not found');
        const oldGroupId = existing.group_id ?? null;

        if (input.groupId !== undefined && input.groupId !== null) {
            const group = await this.groupRepo.findById(input.groupId);
            if (!group) throw new Error('Group not found');
            if (group.user_id !== userId) throw new Error('Group does not belong to the user');
        }

        await this.repo.update(id, userId, input);
        const updated = await this.repo.findById(id, userId);
        if (!updated) throw new Error('Todo not found after update');

        // Cleanup orphan groups: if todo moved away from oldGroup, delete it if empty
        if (oldGroupId != null && oldGroupId !== updated.group_id) {
            await this.groupRepo.deleteIfEmpty(oldGroupId);
        }

        return toTodo(updated);
    }

    async reorder(userId: number, orderedIds: number[]): Promise<Todo[]> {
        await this.repo.reorder(userId, orderedIds);
        return this.listForUser(userId);
    }

    async delete(userId: number, id: number): Promise<boolean> {
        const existing = await this.repo.findById(id, userId);
        if (!existing) throw new Error('Todo not found');
        const groupId = existing.group_id ?? null;
        await this.repo.delete(id, userId);
        if (groupId != null) {
            await this.groupRepo.deleteIfEmpty(groupId);
        }
        return true;
    }
}
