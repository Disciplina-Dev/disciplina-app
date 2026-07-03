import { query } from '../../db/mysql/connection';
import { TodoRow, CreateTodoInput, UpdateTodoInput, TodoSource } from '../../types/todo.types';

export class TodoRepository {
    async findByUser(userId: number): Promise<TodoRow[]> {
        return query<TodoRow[]>(
            'SELECT * FROM todos WHERE user_id = ? ORDER BY position ASC, deadline ASC, created_at ASC',
            [userId],
        );
    }

    async findById(id: number, userId: number): Promise<TodoRow | null> {
        const rows = await query<TodoRow[]>('SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, userId]);
        return rows[0] ?? null;
    }

    async create(userId: number, input: CreateTodoInput, source: TodoSource = 'MANUAL', sourceRef?: string): Promise<number> {
        const maxPos = await query<{ maxPos: number | null }[]>(
            'SELECT MAX(position) as maxPos FROM todos WHERE user_id = ?',
            [userId],
        );
        const position = (maxPos[0]?.maxPos ?? -1) + 1;

        const result = await query<any>(
            `INSERT INTO todos (user_id, title, description, deadline, position, status, source, source_ref)
             VALUES (?, ?, ?, ?, ?, 'TODO', ?, ?)`,
            [userId, input.title, input.description ?? null, input.deadline ?? null, position, source, sourceRef ?? null],
        );
        return result.insertId as number;
    }

    async update(id: number, userId: number, input: UpdateTodoInput): Promise<void> {
        const fields: string[] = [];
        const values: unknown[] = [];

        if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
        if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
        if (input.deadline !== undefined) { fields.push('deadline = ?'); values.push(input.deadline); }
        if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }

        if (fields.length === 0) return;
        values.push(id, userId);

        await query(`UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    }

    async reorder(userId: number, orderedIds: number[]): Promise<void> {
        if (orderedIds.length === 0) return;
        const cases = orderedIds.map((_, i) => `WHEN ? THEN ${i}`).join(' ');
        const ids = orderedIds;
        await query(
            `UPDATE todos SET position = CASE id ${cases} END WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
            [...ids, ...ids, userId],
        );
    }

    async delete(id: number, userId: number): Promise<void> {
        await query('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, userId]);
    }
}
