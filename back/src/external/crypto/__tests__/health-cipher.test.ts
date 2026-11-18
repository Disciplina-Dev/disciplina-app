import { describe, it, expect } from 'vitest';
import {
    encryptHealthValue,
    decryptHealthValue,
    decryptHealthIfNeeded,
    encryptHealthIfNeeded,
    isEncryptedHealth,
    reencryptHealthValue,
    ACTIVE_HEALTH_KID,
} from '../health-cipher';

describe('health-cipher', () => {
    it.each([[true], [false], ['Aménagement : poste adapté'], [{ last_name: 'Doe', phone: '0600000000' }]])(
        'round-trips %j',
        (value) => {
            const enc = encryptHealthValue(value);
            expect(isEncryptedHealth(enc)).toBe(true);
            expect(decryptHealthValue(enc)).toEqual(value);
        },
    );

    it('uses a fresh IV on each call', () => {
        const a = encryptHealthValue('x');
        const b = encryptHealthValue('x');
        expect(a).not.toBe(b);
        expect(decryptHealthValue(a)).toBe('x');
        expect(decryptHealthValue(b)).toBe('x');
    });

    it('throws on a tampered ciphertext', () => {
        const parts = encryptHealthValue('secret').split(':');
        parts[4] = parts[4].replace(/^./, parts[4][0] === '0' ? '1' : '0');
        expect(() => decryptHealthValue(parts.join(':'))).toThrow();
    });

    it('rejects non-encrypted input explicitly', () => {
        expect(() => decryptHealthValue('plain text')).toThrow(/non déchiffrable/);
        expect(isEncryptedHealth('h1:not-hex')).toBe(false);
        expect(isEncryptedHealth(true)).toBe(false);
    });

    it('throws on an unknown kid', () => {
        const parts = encryptHealthValue('x').split(':');
        parts[1] = 'deadbeef';
        expect(() => decryptHealthValue(parts.join(':'))).toThrow(/clé inconnue/);
    });

    it('tolerates plaintext on read and leaves null/undefined untouched', () => {
        expect(decryptHealthIfNeeded(false)).toBe(false);
        expect(decryptHealthIfNeeded('texte libre')).toBe('texte libre');
        expect(decryptHealthIfNeeded(undefined)).toBeUndefined();
        expect(decryptHealthIfNeeded(decryptHealthIfNeeded(encryptHealthValue(true)))).toBe(true);
    });

    it('does not double-encrypt on write', () => {
        const enc = encryptHealthValue(true);
        expect(encryptHealthIfNeeded(enc)).toBe(enc);
        expect(encryptHealthIfNeeded(null)).toBeNull();
        expect(encryptHealthIfNeeded(undefined)).toBeUndefined();
        expect(isEncryptedHealth(encryptHealthIfNeeded(false))).toBe(true);
    });

    it('reencrypt is idempotent: plaintext → current', () => {
        const first = reencryptHealthValue({ phone: '1' });
        expect(first.action).toBe('plaintext');
        expect(first.value.split(':')[1]).toBe(ACTIVE_HEALTH_KID);
        const second = reencryptHealthValue(first.value);
        expect(second.action).toBe('current');
        expect(second.value).toBe(first.value);
    });
});
