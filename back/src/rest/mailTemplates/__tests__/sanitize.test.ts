import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { MailTemplateModel } from '../../../db/mongo/schemas/mailTemplate.schema';
import pool from '../../../db/mysql/connection';

const TRAP_BODY = '<script>alert(1)</script><p onclick="steal()">Bonjour</p><span style="color:#1130A7">salut</span>';

describe('POST/PUT /api/mail-templates — sanitisation à l’écriture', () => {
    let userId: number;
    let authCookies: { cookieHeader: string; csrfHeader: string };
    const suffix = Date.now();

    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
        await MailTemplateModel.deleteMany({});

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`mailtpl-sanitize-${suffix}@test.local`, 'RH', `${suffix}`, `pwd-${suffix}`, 1, 1],
            );
            userId = (result as any).insertId;
        } finally {
            conn.release();
        }

        authCookies = mintAuthCookies({
            id: userId,
            email: `mailtpl-sanitize-${suffix}@test.local`,
            role: 'RH',
            permission: 'EMPLOYEE',
        });
    });

    function postTemplate(body: string) {
        return fetch(`http://localhost:${env.API_PORT}/api/mail-templates?scope=rh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ name: 'Modèle piégé', subject: 'Objet', body }),
        });
    }

    it('retire le HTML actif à la création et relit un document Mongo propre', async () => {
        const res = await postTemplate(TRAP_BODY);
        expect(res.status).toBe(201);
        const { template } = await res.json();

        expect(template.body).not.toContain('<script>');
        expect(template.body).not.toContain('onclick');
        expect(template.body).toContain('color:#1130A7');

        const doc = await MailTemplateModel.findById(template.id).lean<{ body: string }>();
        expect(doc?.body).not.toContain('<script>');
        expect(doc?.body).not.toContain('onclick');
        expect(doc?.body).toContain('color:#1130A7');
    });

    it('retire le HTML actif à la modification', async () => {
        const created = await postTemplate('<p>ok</p>');
        const { template } = await created.json();

        const res = await fetch(`http://localhost:${env.API_PORT}/api/mail-templates/${template.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authCookies.cookieHeader,
                'x-csrf-token': authCookies.csrfHeader,
            },
            body: JSON.stringify({ name: 'Modèle piégé', subject: 'Objet', body: TRAP_BODY }),
        });
        expect(res.status).toBe(200);

        const doc = await MailTemplateModel.findById(template.id).lean<{ body: string }>();
        expect(doc?.body).not.toContain('<script>');
        expect(doc?.body).not.toContain('onclick');
    });
});
