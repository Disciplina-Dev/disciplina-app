import { TodoRepository } from '../repositories/mysql/TodoRepository';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { Todo, TodoRow, CreateTodoInput, UpdateTodoInput } from '../types/todo.types';

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
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

export class TodoService {
    private repo = new TodoRepository();
    private companyRepo = new CompanyRepository();
    private userRepo = new UserRepository();

    async listForUser(userId: number): Promise<Todo[]> {
        await this.syncRelanceTodos(userId);
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
        }
        const id = await this.repo.create(assigneeId, input, 'MANUAL', undefined, assignerId);
        const row = await this.repo.findById(id, assigneeId);
        if (!row) throw new Error('Failed to retrieve created todo');
        return toTodo(row);
    }

    /** Called by system processes (e.g. AB signed). Never exposed via public mutation. */
    async createSystemTodo(userId: number, title: string, sourceRef: string): Promise<void> {
        await this.repo.create(userId, { title }, 'SYSTEM', sourceRef);
    }

    async update(userId: number, id: number, input: UpdateTodoInput): Promise<Todo> {
        const existing = await this.repo.findById(id, userId);
        if (!existing) throw new Error('Todo not found');
        await this.repo.update(id, userId, input);
        const updated = await this.repo.findById(id, userId);
        if (!updated) throw new Error('Todo not found after update');
        return toTodo(updated);
    }

    async reorder(userId: number, orderedIds: number[]): Promise<Todo[]> {
        await this.repo.reorder(userId, orderedIds);
        return this.listForUser(userId);
    }

    async delete(userId: number, id: number): Promise<boolean> {
        const existing = await this.repo.findById(id, userId);
        if (!existing) throw new Error('Todo not found');
        await this.repo.delete(id, userId);
        return true;
    }
}
