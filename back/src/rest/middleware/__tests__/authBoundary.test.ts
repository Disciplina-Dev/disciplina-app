import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { mintToken } from '../../../../test/helpers/auth';

const BASE = `http://localhost:${env.API_PORT}`;

// Les tokens invités sont signés avec le même JWT_SECRET que les tokens staff.
// Seul le contrôle de rôle dans authenticate() les sépare : c'est ce que ce
// fichier verrouille, sur les routes staff qui n'ont pas de requireRoles propre.
function guestToken(role: 'ENTREPRISE_GUEST' | 'CANDIDATE_GUEST'): string {
    return jwt.sign({ role, signature: 'sig', offerId: 'offer-1' }, env.JWT_SECRET, { expiresIn: '1h' });
}

function get(path: string, token?: string) {
    return fetch(`${BASE}${path}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
}

const STAFF_ROUTES = ['/api/sourcing/completion', '/api/auth/directory', '/api/notifications'];

describe('staff/guest boundary on authenticate()', () => {
    it.each(STAFF_ROUTES)('rejects an anonymous call to %s', async (path) => {
        expect((await get(path)).status).toBe(401);
    });

    it.each(STAFF_ROUTES)('rejects an ENTREPRISE_GUEST token on %s', async (path) => {
        expect((await get(path, guestToken('ENTREPRISE_GUEST'))).status).toBe(403);
    });

    it.each(STAFF_ROUTES)('rejects a CANDIDATE_GUEST token on %s', async (path) => {
        expect((await get(path, guestToken('CANDIDATE_GUEST'))).status).toBe(403);
    });

    it.each(STAFF_ROUTES)('lets a staff token through %s', async (path) => {
        const res = await get(path, mintToken({ id: 1, email: 'rh@test.com', role: 'RH' }));
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    it('rejects a token with no role claim', async () => {
        const roleless = jwt.sign({ id: 1, email: 'x@test.com' }, env.JWT_SECRET, { expiresIn: '1h' });
        expect((await get('/api/auth/directory', roleless)).status).toBe(403);
    });

    it('rejects a token signed with the wrong secret', async () => {
        const forged = jwt.sign({ id: 1, email: 'x@test.com', role: 'ADMIN' }, 'not-the-secret', {
            expiresIn: '1h',
        });
        expect((await get('/api/auth/directory', forged)).status).toBe(401);
    });
});

describe('SSE streams', () => {
    it('rejects a stream without a token', async () => {
        expect((await get('/api/notifications/stream')).status).toBe(401);
    });

    it('rejects a stream with a guest token', async () => {
        expect((await get(`/api/notifications/stream?token=${guestToken('ENTREPRISE_GUEST')}`)).status).toBe(403);
    });

    it('no longer trusts a client-supplied userID', async () => {
        expect((await get('/api/notifications/stream?userID=1')).status).toBe(401);
    });
});

describe('security headers', () => {
    it('emits helmet headers', async () => {
        const res = await get('/api/notifications/stream');
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('x-frame-options')).toBeTruthy();
    });
});
