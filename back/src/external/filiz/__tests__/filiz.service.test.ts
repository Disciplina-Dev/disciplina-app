import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { query } from '../../../db/mysql/connection';
import { FilizService } from '../filiz.service';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const isAuth = (url: unknown) => String(url).endsWith('/oauth/token');
const tokenResponse = (token: string) => json(200, { access_token: token, expires_in: 3600, token_type: 'Bearer' });

describe('FilizService (fetch stubbed, real DB token cache)', () => {
    beforeEach(async () => {
        await query('DELETE FROM filiz');
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null and caches nothing when auth is rejected', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => json(401, { error: 'access_denied' })),
        );

        expect(await new FilizService().getClassInfos('d1')).toBeNull();
        expect(await query<unknown[]>('SELECT 1 FROM filiz')).toHaveLength(0);
    });

    it('regenerates the token and retries once on a 401', async () => {
        let apiCalls = 0;
        let tokens = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: unknown) => {
                if (isAuth(url)) return tokenResponse(`tok-${++tokens}`);
                return ++apiCalls === 1 ? json(401, {}) : json(200, [{ classId: 'c1' }]);
            }),
        );

        expect(await new FilizService().getClassInfos('d1')).toEqual([{ classId: 'c1' }]);
        expect(tokens).toBe(2);
        expect(apiCalls).toBe(2);
    });

    it('shares a single auth call between concurrent requests', async () => {
        let authCalls = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: unknown) => {
                if (isAuth(url)) {
                    authCalls++;
                    return tokenResponse('tok');
                }
                return json(200, []);
            }),
        );

        const service = new FilizService();
        await Promise.all([service.getClassInfos('a'), service.getClassInfos('b'), service.getClassInfos('c')]);
        expect(authCalls).toBe(1);
    });

    it('returns null on a non-2xx API response', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: unknown) => (isAuth(url) ? tokenResponse('t') : json(500, { error: 'boom' }))),
        );
        expect(await new FilizService().getDegreesInfos()).toBeNull();
    });
});
