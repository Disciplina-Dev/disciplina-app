import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { authenticateStaffStream } from '../sseAuth';
import { ACCESS_TOKEN_COOKIE, signAccessToken } from '../tokenAuth';
import { env } from '../../../config/env';

function fakeRequest(claims: Record<string, unknown>) {
    const token = signAccessToken({ role: 'RH', permission: 'any', ...claims });
    return { cookies: { [ACCESS_TOKEN_COOKIE]: token } } as any;
}

function fakeResponse() {
    return { status: vi.fn().mockReturnThis(), end: vi.fn() } as unknown as Response;
}

describe('authenticateStaffStream', () => {
    it('résout la région depuis le token', () => {
        const staff = authenticateStaffStream(fakeRequest({ id: 5, region: 'annemasse' }), fakeResponse());
        expect(staff?.region).toBe('annemasse');
    });

    it('repli sur le tenant par défaut pour les tokens legacy sans région', () => {
        const staff = authenticateStaffStream(fakeRequest({ id: 5 }), fakeResponse());
        expect(staff?.region).toBe(env.DB_DEFAULT_TENANT);
    });

    it('rejette les rôles non-staff', () => {
        const res = fakeResponse();
        const staff = authenticateStaffStream(fakeRequest({ id: 5, role: 'CANDIDATE' }), res);
        expect(staff).toBeNull();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});