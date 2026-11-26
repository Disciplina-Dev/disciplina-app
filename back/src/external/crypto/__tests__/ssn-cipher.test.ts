import { describe, it, expect } from 'vitest';
import { scryptSync, randomBytes, createCipheriv } from 'crypto';
import { encryptSsn, decryptSsn, isEncryptedSsn, reencryptSsnValue, ACTIVE_SSN_KID, MASKED_SSN } from '../ssn-cipher';

describe('ssn-cipher', () => {
    it('decrypts back to the original plaintext', () => {
        const plain = '123456789012345';
        const encrypted = encryptSsn(plain);

        expect(decryptSsn(encrypted)).toBe(plain);
    });

    it('produces a different ciphertext (and iv) on each call, but both decrypt to the same plaintext', () => {
        const plain = '999888777666555';
        const a = encryptSsn(plain);
        const b = encryptSsn(plain);

        expect(a.encrypted).not.toBe(b.encrypted);
        expect(a.iv).not.toBe(b.iv);
        expect(decryptSsn(a)).toBe(plain);
        expect(decryptSsn(b)).toBe(plain);
    });

    it('throws when the auth tag does not match (tampered ciphertext)', () => {
        const encrypted = encryptSsn('111223334445555');
        const tampered = { ...encrypted, tag: encrypted.tag.replace(/^./, encrypted.tag[0] === '0' ? '1' : '0') };

        expect(() => decryptSsn(tampered)).toThrow();
    });

    // Les fiches legacy portent un NIR en clair (string) : le rejet doit être explicite
    // et non un TypeError opaque venant de Buffer.from(undefined, 'hex').
    it('rejects a legacy plaintext string with an explicit message', () => {
        expect(() => decryptSsn('1851275116001' as unknown as never)).toThrow(/non déchiffrable/);
    });

    it('rejects incomplete or malformed triplets', () => {
        const { encrypted, iv } = encryptSsn('123456789012345');

        expect(() => decryptSsn({ encrypted, iv } as unknown as never)).toThrow(/non déchiffrable/);
        expect(() => decryptSsn({ encrypted, iv, tag: 'zz-not-hex' } as unknown as never)).toThrow(/non déchiffrable/);
        expect(() => decryptSsn(null as unknown as never)).toThrow(/non déchiffrable/);
        expect(() => decryptSsn(undefined as unknown as never)).toThrow(/non déchiffrable/);
    });

    it('isEncryptedSsn accepts a freshly produced triplet and rejects a plaintext string', () => {
        expect(isEncryptedSsn(encryptSsn('123456789012345'))).toBe(true);
        expect(isEncryptedSsn('1851275116001')).toBe(false);
    });

    it('MASKED_SSN placeholder is unaffected by encrypt/decrypt', () => {
        expect(MASKED_SSN).toBe('[chiffré]');
    });

    it('writes a kid and decrypts it with the active key', () => {
        const enc = encryptSsn('185127511600123');
        expect(enc.kid).toBe(ACTIVE_SSN_KID);
        expect(decryptSsn(enc)).toBe('185127511600123');
    });

    it('still decrypts the legacy format (no kid, scrypt + hard-coded salt)', () => {
        const key = scryptSync(process.env.SSN_ENCRYPTION_KEY!, 'ssn-salt', 32);
        const iv = randomBytes(16);
        const c = createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([c.update('185127511600123', 'utf8'), c.final()]);
        const legacy = { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex') };
        expect(decryptSsn(legacy)).toBe('185127511600123');
        const res = reencryptSsnValue(legacy);
        expect(res.action).toBe('rotated');
        expect(res.value.kid).toBe(ACTIVE_SSN_KID);
        expect(decryptSsn(res.value)).toBe('185127511600123');
    });

    it('rejects an unknown kid', () => {
        const enc = { ...encryptSsn('185127511600123'), kid: 'deadbeef' };
        expect(() => decryptSsn(enc)).toThrow(/clé inconnue/);
    });

    it('reencryptSsnValue handles plaintext, is idempotent on current values', () => {
        const a = reencryptSsnValue('185127511600123');
        expect(a.action).toBe('plaintext');
        expect(decryptSsn(a.value)).toBe('185127511600123');
        const b = reencryptSsnValue(a.value);
        expect(b.action).toBe('current');
        expect(b.value).toEqual(a.value);
        expect(() => reencryptSsnValue('  ')).toThrow();
    });
});
