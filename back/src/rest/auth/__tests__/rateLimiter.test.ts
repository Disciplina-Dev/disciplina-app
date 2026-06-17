import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';

const LOGIN_URL = `http://localhost:${env.API_PORT}/api/auth/login`;

const BODY = JSON.stringify({ email: 'ratelimit@test.com', password: 'wrong' });
const HEADERS = { 'Content-Type': 'application/json' };

describe('login rate limiting', () => {
    it('returns 429 after 10 requests in the same window', async () => {
        for (let i = 0; i < 10; i++) {
            const res = await fetch(LOGIN_URL, { method: 'POST', body: BODY, headers: HEADERS });
            expect(res.status).not.toBe(429);
        }

        const res = await fetch(LOGIN_URL, { method: 'POST', body: BODY, headers: HEADERS });
        expect(res.status).toBe(429);
    });
});
