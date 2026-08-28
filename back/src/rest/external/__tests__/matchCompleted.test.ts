import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../../config/env';
import { ExternalAccessRepository } from '../../../repositories/mysql/ExternalAccessRepository';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../../middleware/tokenAuth';
import { GuestRole, Permission } from '../../../types/user.types';
import { truncateMysql } from '../../../../test/helpers/db';

const BASE = `http://localhost:${env.API_PORT}/api/external`;

const repository = new ExternalAccessRepository();
const userRepository = new UserRepository();

function signature(name: string): string {
    return `${name}-${Date.now()}`.padEnd(64, '0');
}

async function createRhUser(): Promise<number> {
    const email = `rh-match-ext-${Date.now()}@test.local`;
    const id = await userRepository.create({
        email,
        first_name: 'RH',
        last_name: 'MatchExt',
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
    return id;
}

async function createRow(
    sig: string,
    overrides: Partial<Parameters<ExternalAccessRepository['create']>[0]> = {},
): Promise<void> {
    const userId = await createRhUser();
    await repository.create({
        signature: sig,
        code: '123456',
        user_id: userId,
        external_id: `offer-${sig.slice(0, 8)}`,
        external_type: 'COMPANY',
        external_email: 'company@test.local',
        external_first_name: 'Acme',
        reference_id: 2,
        reference_key: `offer-${sig.slice(0, 8)}`,
        status: 'PENDING',
        attempts: 0,
        expires_at: null,
        ...overrides,
    });
}

function guestCookie(sig: string, referenceId: number = 2): string {
    const token = signAccessToken({
        role: GuestRole.EXTERNAL_GUEST,
        permission: Permission.GUEST,
        signature: sig,
        referenceId,
    });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

describe('POST /api/external/:signature/match/answers — session matching', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('rejects without a guest cookie', async () => {
        const res = await fetch(`${BASE}/some-signature/match/answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: [] }),
        });
        expect(res.status).toBe(401);
    });

    it('rejects a session that is not a matching reference (403)', async () => {
        const sig = signature('sig-not-ref2');
        await createRow(sig, { reference_id: 1 });

        const res = await fetch(`${BASE}/${sig}/match/answers`, {
            method: 'POST',
            headers: {
                Cookie: guestCookie(sig, 1),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers: [{ candidateId: 'c1', status: 'REFUSED' }] }),
        });
        expect(res.status).toBe(403);
    });

    it('rejects a re-submission on an already COMPLETED session with 409', async () => {
        const sig = signature('sig-match-answers');
        await createRow(sig, { status: 'COMPLETED' });

        const res = await fetch(`${BASE}/${sig}/match/answers`, {
            method: 'POST',
            headers: {
                Cookie: guestCookie(sig),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers: [{ candidateId: 'c1', status: 'REFUSED' }] }),
        });
        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toEqual({ error: 'Session already completed' });
        expect((await repository.findBySignature(sig))?.status).toBe('COMPLETED');
    });

    it('lets an AUTHENTICATED matching session through the guard (guard does not block)', async () => {
        const sig = signature('sig-match-auth');
        await createRow(sig, { status: 'AUTHENTICATED' });

        // L'offre référencée n'existe pas : si le guard (cookie + reference 2) passait,
        // le service renvoie « Offer not found » en 400 — jamais un 401/403.
        const res = await fetch(`${BASE}/${sig}/match/answers`, {
            method: 'POST',
            headers: {
                Cookie: guestCookie(sig),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers: [{ candidateId: 'c1', status: 'REFUSED' }] }),
        });
        expect(res.status).toBe(400);
    });
});
