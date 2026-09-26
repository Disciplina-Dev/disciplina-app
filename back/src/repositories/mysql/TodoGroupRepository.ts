import { query } from '../../db/mysql/connection';
import { TodoGroupRow } from '../../types/todo.types';

export class TodoGroupRepository {
    async findByUser(userId: number): Promise<TodoGroupRow[]> {
        return query<TodoGroupRow[]>(
            'SELECT * FROM todo_groups WHERE user_id = ? ORDER BY name ASC',
            [userId],
        );
    }

    async findById(id: number): Promise<TodoGroupRow | null> {
        const rows = await query<TodoGroupRow[]>('SELECT * FROM todo_groups WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async findByName(userId: number, name: string): Promise<TodoGroupRow | null> {
        const rows = await query<TodoGroupRow[]>(
            'SELECT * FROM todo_groups WHERE user_id = ? AND name = ?',
            [userId, name],
        );
        return rows[0] ?? null;
    }

    async create(userId: number, name: string): Promise<number> {
        const result = await query<any>(
            'INSERT INTO todo_groups (user_id, name) VALUES (?, ?)',
            [userId, name],
        );
        return result.insertId as number;
    }

    async deleteIfEmpty(groupId: number): Promise<boolean> {
        const countRows = await query<{ cnt: number }[]>(
            'SELECT COUNT(*) as cnt FROM todos WHERE group_id = ? AND deleted = 0',
            [groupId],
        );
        const cnt = Number(countRows[0]?.cnt ?? 0);
        if (cnt === 0) {
            await query('DELETE FROM todo_groups WHERE id = ?', [groupId]);
            return true;
        }
        return false;
    }

    async deleteOrphansForUser(userId: number): Promise<void> {
        await query(
            `DELETE tg FROM todo_groups tg
             LEFT JOIN todos t ON t.group_id = tg.id AND t.deleted = 0
             WHERE tg.user_id = ? AND t.id IS NULL`,
            [userId],
        );
    }
}
