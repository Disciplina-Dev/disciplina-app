import { describe, it, expect } from 'vitest';
import { encryptSsn, decryptSsn, MASKED_SSN } from '../ssn-cipher';

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

    it('MASKED_SSN placeholder is unaffected by encrypt/decrypt', () => {
        expect(MASKED_SSN).toBe('[chiffré]');
    });
});
