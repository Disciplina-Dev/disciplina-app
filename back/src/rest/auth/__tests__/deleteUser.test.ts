import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import pool from '../../../db/mysql/connection';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { UserService } from '../../../services/UserService';
import { NeedsAnalysisModel } from '../../../db/mongo/schemas/needsAnalysis.schema';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';
import { NotificationModel } from '../../../db/mongo/schemas/notification.schema';
import { CandidateModel } from '../../../db/mongo/schemas/candidate.schema';
import { CandidateStatus } from '../../../types/candidate.types';

const URL = `http://localhost:${env.API_PORT}/api/auth/users`;

const admin = mintAuthCookies({ id: 999, email: 'admin@test.com', role: 'AD', permission: 'ADMIN' });

function del(id: number, body?: Record<string, unknown>, auth = admin) {
    return fetch(`${URL}/${id}`, {
        method: 'DELETE',
        headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
}

async function seedUser(email: string, roleId: number, permissionId = 1): Promise<number> {
    return new UserRepository().create({
        email,
        first_name: 'First',
        last_name: email.split('@')[0],
        password: await bcrypt.hash('Password123456', 10),
        role_id: roleId,
        permission_id: permissionId,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function seedCompany(userId: number | null, siret: string): Promise<number> {
    const [result] = await pool.query(
        'INSERT INTO companies (user_id, name, address, siret) VALUES (?, ?, ?, ?)',
        [userId, `Entreprise ${siret}`, 'Adresse', siret],
    );
    return (result as any).insertId;
}

async function rawInsert(sql: string, params: unknown[]): Promise<void> {
    await pool.query(sql, params);
}

beforeEach(async () => {
    await truncateMysql();
    await Promise.all([
        NeedsAnalysisModel.deleteMany({}),
        OfferModel.deleteMany({}),
        NotificationModel.deleteMany({}),
    ]);
});

describe('DELETE /api/auth/users/:id — guards', () => {
    it('rejects non-admin callers', async () => {
        const target = await seedUser('c1@test.com', 1);
        const res = await del(
            target,
            {},
            mintAuthCookies({ id: 998, email: 'c@test.com', role: 'COMMERCIAL', permission: 'EMPLOYEE' }),
        );
        expect(res.status).toBe(403);
    });

    it('returns 404 for unknown user', async () => {
        const res = await del(4242);
        expect(res.status).toBe(404);
    });

    it('forbids self-deletion', async () => {
        const adminId = await seedUser('boss@test.com', 4, 3);
        const res = await del(adminId, {}, mintAuthCookies({ id: adminId, email: 'x@test.com', role: 'AD', permission: 'ADMIN' }));
        expect(res.status).toBe(409);
    });

    it('forbids deleting the last active admin', async () => {
        const lastAdmin = await seedUser('last@test.com', 5, 3);
        const res = await del(lastAdmin);
        expect(res.status).toBe(409);
    });

    it('rejects a replacement from another role', async () => {
        const target = await seedUser('comm@test.com', 1);
        await seedUser('rh@test.com', 2);
        const res = await del(target, { replacementUserId: 2 });
        expect(res.status).toBe(409);
    });
});

describe('DELETE /api/auth/users/:id — detach path (no replacement)', () => {
    it('flags the user, detaches relations, purges personal data and revokes sessions', async () => {
        const target = await seedUser('depart@test.com', 1);
        const colleague = await seedUser('reste@test.com', 1);

        await seedCompany(target, '900000001');
        await rawInsert('INSERT INTO company_conflict (user_id) VALUES (?)', [target]);
        await rawInsert('INSERT INTO companies_blacklist (user_id, name, address, siret) VALUES (?, ?, ?, ?)', [
            target,
            'Blacklistée',
            'Adresse',
            '900000002',
        ]);
        await rawInsert('INSERT INTO todo_groups (user_id, name) VALUES (?, ?)', [target, 'Mon groupe']);
        await rawInsert('INSERT INTO todos (user_id, title) VALUES (?, ?)', [target, 'Todo du supprimé']);
        // Todo d'un collègue assigné par le supprimé : doit survivre, attribution perdue.
        await rawInsert('INSERT INTO todos (user_id, assigned_by, title) VALUES (?, ?, ?)', [
            colleague,
            target,
            'Todo du collègue',
        ]);
        await rawInsert('INSERT INTO booking_settings (user_id, slug) VALUES (?, ?)', [target, 'slug-depart']);
        await rawInsert(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL 1 DAY)',
            [target, 'deadbeef'],
        );

        await NeedsAnalysisModel.create({ _id: 'na-1', saler_info: { id: target, email: 'depart@test.com' } });
        await OfferModel.create({ _id: 'off-1', needs_analysis_id: 'na-1', saler_info: { id: target, email: 'depart@test.com' } });
        await NotificationModel.create({ _id: 'n-1', user_id: target, type: 'info', title: 'Hello' });

        const res = await del(target);
        expect(res.status).toBe(200);

        // Ligne users toujours là mais flaggée ; sort des listes et du login.
        const repo = new UserRepository();
        const flagged = await repo.findByIdIncludingDeleted(target);
        expect(flagged?.is_deleted).toBe(1);
        expect(flagged?.deleted_at).not.toBeNull();
        expect(await repo.findById(target)).toBeNull();
        expect((await repo.findAll()).some((u) => u.id === target)).toBe(false);
        const userService = new UserService();
        expect(await userService.findByEmail('depart@test.com')).toBeNull();

        // Relations détachées : l'entreprise vit sans commercial.
        const [[company]] = await pool.query<any[]>('SELECT user_id FROM companies WHERE siret = ?', ['900000001']);
        expect(company.user_id).toBeNull();
        const [[conflict]] = await pool.query<any[]>('SELECT user_id FROM company_conflict WHERE user_id IS NULL');
        expect(conflict).toBeTruthy();
        const [[blacklistRow]] = await pool.query<any[]>(
            'SELECT user_id FROM companies_blacklist WHERE siret = ?',
            ['900000002'],
        );
        expect(blacklistRow.user_id).toBeNull();

        // Todos personnels supprimés, todo du collègue conservé sans attribution.
        const [[ownTodos]] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM todos WHERE user_id = ?', [target]);
        expect(ownTodos.n).toBe(0);
        const [[colleagueTodo]] = await pool.query<any[]>(
            'SELECT assigned_by FROM todos WHERE title = ?',
            ['Todo du collègue'],
        );
        expect(colleagueTodo.assigned_by).toBeNull();

        // Config personnelles + sessions purgées.
        const [[settings]] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM booking_settings WHERE user_id = ?', [target]);
        expect(settings.n).toBe(0);
        const [[tokens]] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ?', [target]);
        expect(tokens.n).toBe(0);

        // Mongo : saler_info retiré, notifications purgées.
        const na = await NeedsAnalysisModel.findById('na-1').lean();
        expect(na?.saler_info).toBeUndefined();
        const offer = await OfferModel.findById('off-1').lean();
        expect(offer?.saler_info).toBeUndefined();
        expect(await NotificationModel.countDocuments({ user_id: target })).toBe(0);

        // Le collègue reste actif et non impacté sur son compte.
        const colleagueRow = await repo.findById(colleague);
        expect(colleagueRow?.is_deleted ?? 0).toBe(0);
    });
});

describe('DELETE /api/auth/users/:id — reassignment path', () => {
    it('transfers MySQL and Mongo relations to a same-role replacement', async () => {
        const target = await seedUser('partant@test.com', 1);
        const replacement = await seedUser('remplacant@test.com', 1);

        await seedCompany(target, '900000003');
        await NeedsAnalysisModel.create({ _id: 'na-2', saler_info: { id: target, email: 'partant@test.com' } });
        await OfferModel.create({ _id: 'off-2', needs_analysis_id: 'na-2', saler_info: { id: target, email: 'partant@test.com' } });

        const res = await del(target, { replacementUserId: replacement });
        expect(res.status).toBe(200);

        const [[company]] = await pool.query<any[]>('SELECT user_id FROM companies WHERE siret = ?', ['900000003']);
        expect(company.user_id).toBe(replacement);

        const na = await NeedsAnalysisModel.findById('na-2').lean();
        expect(na?.saler_info?.id).toBe(replacement);
        expect(na?.saler_info?.email).toBe('remplacant@test.com');
        const offer = await OfferModel.findById('off-2').lean();
        expect(offer?.saler_info?.id).toBe(replacement);
    });

    it('reassigns owned candidate folders to the replacement RH', async () => {
        const targetRh = await seedUser('rh-depart@test.com', 2);
        const replacementRh = await seedUser('rh-reste@test.com', 2);

        await CandidateModel.create({
            _id: 'cand-1',
            candidate_id: 'cand-1-uuid',
            identity: { full_name: 'Candidat Test', email: 'candidat@test.com', phone: '0000000000' },
            status: CandidateStatus.SEEKING,
            owner: { user_id: targetRh, name: 'First rh-depart' },
        });

        const res = await del(targetRh, { replacementUserId: replacementRh });
        expect(res.status).toBe(200);

        const cand = await CandidateModel.findById('cand-1').lean();
        expect(cand?.owner?.user_id).toBe(replacementRh);
        expect(cand?.owner?.name).toContain('rh-reste');
    });
});
