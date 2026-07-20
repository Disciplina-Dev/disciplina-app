import { describe, it, expect } from 'vitest';
import { isPublicUrl, isPrivateAddress } from '../urlGuard';

// Littéraux IP et « localhost » uniquement : aucune résolution DNS réseau,
// le test reste déterministe en CI.
describe('isPrivateAddress', () => {
    const privates = [
        '127.0.0.1',
        '10.0.0.5',
        '172.16.4.2',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '::1',
        'fe80::1',
        'fd00::1',
        '::ffff:127.0.0.1',
    ];
    const publics = ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '2001:4860:4860::8888'];

    it.each(privates)('rejects %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));
    it.each(publics)('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));

    it('rejects anything that is not an IP', () => {
        expect(isPrivateAddress('not-an-ip')).toBe(true);
    });
});

describe('isPublicUrl', () => {
    it('refuses cloud metadata', async () => {
        expect(await isPublicUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    it('refuses loopback by name', async () => {
        expect(await isPublicUrl('http://localhost:11434/api/tags')).toBe(false);
    });

    it('refuses loopback by IP', async () => {
        expect(await isPublicUrl('http://127.0.0.1:4000/api/auth/users')).toBe(false);
    });

    it('refuses private ranges', async () => {
        expect(await isPublicUrl('http://10.0.0.5/')).toBe(false);
        expect(await isPublicUrl('http://192.168.1.1/admin')).toBe(false);
    });

    it('refuses non-http protocols', async () => {
        expect(await isPublicUrl('file:///etc/passwd')).toBe(false);
        expect(await isPublicUrl('gopher://x/')).toBe(false);
        expect(await isPublicUrl('ftp://example.com/')).toBe(false);
    });

    it('refuses malformed input', async () => {
        expect(await isPublicUrl('not a url')).toBe(false);
        expect(await isPublicUrl('')).toBe(false);
    });

    it('allows a public IP literal', async () => {
        expect(await isPublicUrl('http://8.8.8.8/')).toBe(true);
    });
});
