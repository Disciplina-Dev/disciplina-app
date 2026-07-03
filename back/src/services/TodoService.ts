import { TodoRepository } from '../repositories/mysql/TodoRepository';
import { Todo, TodoRow, CreateTodoInput, UpdateTodoInput } from '../types/todo.types';

function toTodo(row: TodoRow): Todo {
    return {
        id: row.id,
        userId: row.user_id,
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

    async listForUser(userId: number): Promise<Todo[]> {
        const rows = await this.repo.findByUser(userId);
        return rows.map(toTodo);
    }

    async create(userId: number, input: CreateTodoInput): Promise<Todo> {
        const id = await this.repo.create(userId, input, 'MANUAL');
        const row = await this.repo.findById(id, userId);
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
