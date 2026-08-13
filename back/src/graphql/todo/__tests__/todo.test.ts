import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import pool from '../../../db/mysql/connection';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

async function insertUser(suffix: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.execute(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
            [`todo-${suffix}@test.local`, 'Todo', 'User', 'password', 1, 1],
        );
        return (result as any).insertId as number;
    } finally {
        conn.release();
    }
}

function post(
    cookieHeader: string,
    csrfHeader: string,
    query: string,
    variables?: Record<string, unknown>,
): ReturnType<typeof fetch> {
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            'x-csrf-token': csrfHeader,
        },
        body: JSON.stringify({ query, variables }),
    });
}

describe('GraphQL todos', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('creates a todo assigned to the current user by default', async () => {
        const meId = await insertUser('self');
        const auth = mintAuthCookies({ id: meId, email: `todo-self@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });

        const res = await post(
            auth.cookieHeader,
            auth.csrfHeader,
            `mutation($input: CreateTodoInput!) { createTodo(input: $input) { id userId assignedBy title } }`,
            { input: { title: 'Ma tâche' } },
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.createTodo.userId).toBe(meId);
        expect(json.data.createTodo.assignedBy).toBe(meId);
    });

    it('creates a todo assigned to another user, visible in their list only', async () => {
        const meId = await insertUser('assigner');
        const otherId = await insertUser('assignee');
        const auth = mintAuthCookies({ id: meId, email: `todo-assigner@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });

        const res = await post(
            auth.cookieHeader,
            auth.csrfHeader,
            `mutation($input: CreateTodoInput!) { createTodo(input: $input) { id userId assignedBy title } }`,
            { input: { title: 'Pour lautre', assignedTo: otherId } },
        );
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.createTodo.userId).toBe(otherId);
        expect(json.data.createTodo.assignedBy).toBe(meId);

        // The assigner must not see the task in their own list.
        const mineRes = await post(auth.cookieHeader, auth.csrfHeader, '{ myTodos { id userId assignedBy } }');
        const mineJson = await mineRes.json();
        expect(mineJson.errors).toBeUndefined();
        expect(mineJson.data.myTodos).toEqual([]);

        // The assignee sees it in their list.
        const otherAuth = mintAuthCookies({ id: otherId, email: `todo-assignee@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });
        const otherRes = await post(otherAuth.cookieHeader, otherAuth.csrfHeader, '{ myTodos { id userId assignedBy title } }');
        const otherJson = await otherRes.json();
        expect(otherJson.errors).toBeUndefined();
        expect(otherJson.data.myTodos).toHaveLength(1);
        expect(otherJson.data.myTodos[0].userId).toBe(otherId);
        expect(otherJson.data.myTodos[0].assignedBy).toBe(meId);
        expect(otherJson.data.myTodos[0].title).toBe('Pour lautre');
    });

    it('rejects an unknown assignee', async () => {
        const meId = await insertUser('unknown');
        const auth = mintAuthCookies({ id: meId, email: `todo-unknown@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });

        const res = await post(
            auth.cookieHeader,
            auth.csrfHeader,
            `mutation($input: CreateTodoInput!) { createTodo(input: $input) { id userId assignedBy } }`,
            { input: { title: 'Vers un fantôme', assignedTo: 999999 } },
        );
        const json = await res.json();
        expect(json.errors).toBeDefined();
    });

    it('notifies the assignee when a task is assigned to them', async () => {
        const meId = await insertUser('notif-assigner');
        const otherId = await insertUser('notif-assignee');
        const auth = mintAuthCookies({ id: meId, email: `todo-notif-assigner@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });
        const otherAuth = mintAuthCookies({ id: otherId, email: `todo-notif-assignee@test.local`, role: 'COMMERCIAL', permission: 'EMPLOYEE' });

        const res = await post(
            auth.cookieHeader,
            auth.csrfHeader,
            `mutation($input: CreateTodoInput!) { createTodo(input: $input) { id userId assignedBy } }`,
            { input: { title: 'Tâche notifiée', assignedTo: otherId } },
        );
        const json = await res.json();
        expect(json.errors).toBeUndefined();

        const notifRes = await fetch(`http://localhost:${env.API_PORT}/api/notifications`, {
            headers: { Cookie: otherAuth.cookieHeader },
        });
        expect(notifRes.status).toBe(200);
        const notifJson = await notifRes.json();
        const todoNotif = notifJson.notifications.find(
            (n: { type: string }) => n.type === 'todo_assigned',
        );
        expect(todoNotif).toBeDefined();
        expect(todoNotif.message).toContain('Tâche notifiée');
        expect(todoNotif.link).toBe('/commercial/todos');

        // Notifier n'est pas crédité : l'auteur ne reçoit pas de notification pour une tâche à lui.
        const mineRes = await fetch(`http://localhost:${env.API_PORT}/api/notifications`, {
            headers: { Cookie: auth.cookieHeader },
        });
        const mineJson = await mineRes.json();
        expect(mineJson.notifications).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'todo_assigned' })]),
        );
    });
});