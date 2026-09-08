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
    const email = `rh-external-${Date.now()}@test.local`;
    const id = await userRepository.create({
        email,
        first_name: 'RH',
        last_name: 'External',
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
    return id;
}

async function createRow(sig: string, overrides: Partial<Parameters<ExternalAccessRepository['create']>[0]> = {}) {
    const userId = await createRhUser();
    return {
        userId,
        row: await repository.create({
            signature: sig,
            code: '123456',
            user_id: userId,
            external_id: `ext-${sig.slice(0, 8)}`,
            external_type: 'CANDIDATE',
            external_email: 'candidate@test.local',
            external_first_name: 'Candidate',
            reference_id: 1,
            reference_key: `ref-${sig.slice(0, 8)}`,
            status: 'PENDING',
            attempts: 0,
            expires_at: null,
            ...overrides,
        }),
    };
}

function guestCookie(sig: string): string {
    const token = signAccessToken({
        role: GuestRole.EXTERNAL_GUEST,
        permission: Permission.GUEST,
        signature: sig,
        referenceId: 1,
    });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

describe('External access completion flow', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    describe('POST /:signature/completed', () => {
        it('rejects without a guest cookie', async () => {
            const res = await fetch(`${BASE}/some-signature/completed`, { method: 'POST' });
            expect(res.status).toBe(401);
        });

        it('rejects a token whose signature does not match the route signature', async () => {
            const sig = signature('sig-mismatch');
            await createRow(sig);

            const res = await fetch(`${BASE}/${sig}/completed`, {
                method: 'POST',
                headers: { Cookie: guestCookie('another-signature') },
            });
            expect(res.status).toBe(401);
        });

        it('marks the session COMPLETED and is idempotent on repeat calls', async () => {
            const sig = signature('sig-ok');
            await createRow(sig);

            const first = await fetch(`${BASE}/${sig}/completed`, {
                method: 'POST',
                headers: { Cookie: guestCookie(sig) },
            });
            expect(first.status).toBe(200);
            await expect(first.json()).resolves.toEqual({ success: true });
            expect((await repository.findBySignature(sig))?.status).toBe('COMPLETED');

            const second = await fetch(`${BASE}/${sig}/completed`, {
                method: 'POST',
                headers: { Cookie: guestCookie(sig) },
            });
            expect(second.status).toBe(200);
            expect((await repository.findBySignature(sig))?.status).toBe('COMPLETED');
        });

        it('rejects a non-existent session through the guard', async () => {
            const sig = signature('sig-ghost');

            const res = await fetch(`${BASE}/${sig}/completed`, {
                method: 'POST',
                headers: { Cookie: guestCookie(sig) },
            });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /:signature/cv-upload', () => {
        it('rejects re-upload once the session is COMPLETED', async () => {
            const sig = signature('sig-done');
            await createRow(sig, { status: 'COMPLETED' });

            const res = await fetch(`${BASE}/${sig}/cv-upload`, {
                method: 'POST',
                headers: {
                    Cookie: guestCookie(sig),
                    'Content-Type': 'application/pdf',
                },
                body: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), // "%PDF-"
            });
            expect(res.status).toBe(409);
            await expect(res.json()).resolves.toMatchObject({ error: 'CV déjà importé' });
        });

        it('still allows upload while AUTHENTICATED', async () => {
            const sig = signature('sig-auth');
            await createRow(sig, { status: 'AUTHENTICATED' });

            const res = await fetch(`${BASE}/${sig}/cv-upload`, {
                method: 'POST',
                headers: {
                    Cookie: guestCookie(sig),
                    'Content-Type': 'application/pdf',
                },
                body: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
            });
            // Candidat inexistant : prouve que le guard passe (pas de 401/409)
            // et que le traitement continue côté candidat.
            expect(res.status).toBe(404);
        });
    });
});