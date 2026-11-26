import { describe, expect, it } from 'vitest';
import { toolResult } from '../serialize';

const parse = (data: unknown) => JSON.parse(toolResult(data).content[0].text);

describe('toolResult', () => {
    it('serializes Date as ISO string instead of {}', () => {
        const out = parse({ createdAt: new Date('2026-01-02T03:04:05.000Z'), nested: [{ d: new Date(0) }] });
        expect(out.createdAt).toBe('2026-01-02T03:04:05.000Z');
        expect(out.nested[0].d).toBe('1970-01-01T00:00:00.000Z');
    });

    it('strips credential-looking keys', () => {
        expect(parse({ name: 'a', password: 'x', apiKey: 'y' })).toEqual({ name: 'a' });
    });
});

describe('toolResult sensitive keys', () => {
    it('strips token/hash/salt variants but keeps unrelated keys', () => {
        const out = parse({
            accessToken: 'a',
            reset_token: 'b',
            passwordHash: 'c',
            password_hash: 'd',
            salt: 'e',
            hashtag: 'keep',
            tokenCount: 3,
            hashed: 'f',
        });
        expect(out).toEqual({ hashtag: 'keep', tokenCount: 3 });
    });
});
