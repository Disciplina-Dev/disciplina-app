import { describe, it, expect } from 'vitest';
import { HmacService } from '../hmac.service';

describe('HmacService', () => {
    const service = new HmacService();

    describe('sign', () => {
        it('returns a 64-char lowercase hex string (SHA-256 output)', () => {
            const secret = 'test-secret';
            const payload = 'test-payload';
            const sig = service.sign(secret, payload);
            expect(sig).toMatch(/^[0-9a-f]{64}$/);
        });

        it('produces deterministic signatures', () => {
            const secret = 'secret';
            const payload = 'payload';
            const sig1 = service.sign(secret, payload);
            const sig2 = service.sign(secret, payload);
            expect(sig1).toBe(sig2);
        });

        it('produces different signatures for different payloads', () => {
            const secret = 'secret';
            const sig1 = service.sign(secret, 'payload1');
            const sig2 = service.sign(secret, 'payload2');
            expect(sig1).not.toBe(sig2);
        });

        it('produces different signatures for different secrets', () => {
            const payload = 'payload';
            const sig1 = service.sign('secret1', payload);
            const sig2 = service.sign('secret2', payload);
            expect(sig1).not.toBe(sig2);
        });
    });

    describe('verify', () => {
        it('returns true for a valid signature', () => {
            const secret = 'test-secret';
            const payload = 'test-payload';
            const sig = service.sign(secret, payload);
            const result = service.verify(secret, payload, sig);
            expect(result).toBe(true);
        });

        it('returns false for a wrong signature (different payload)', () => {
            const secret = 'test-secret';
            const sig = service.sign(secret, 'correct-payload');
            const result = service.verify(secret, 'wrong-payload', sig);
            expect(result).toBe(false);
        });

        it('returns false for a wrong signature (different secret)', () => {
            const payload = 'test-payload';
            const sig = service.sign('correct-secret', payload);
            const result = service.verify('wrong-secret', payload, sig);
            expect(result).toBe(false);
        });

        it('returns false when signature has wrong length', () => {
            const secret = 'test-secret';
            const payload = 'test-payload';
            const result = service.verify(secret, payload, 'tooshort');
            expect(result).toBe(false);
        });

        it('returns false for an empty signature', () => {
            const secret = 'test-secret';
            const payload = 'test-payload';
            const result = service.verify(secret, payload, '');
            expect(result).toBe(false);
        });

        it('returns false for a completely wrong signature (correct length but wrong content)', () => {
            const secret = 'test-secret';
            const payload = 'test-payload';
            const wrongSig = 'a'.repeat(64);
            const result = service.verify(secret, payload, wrongSig);
            expect(result).toBe(false);
        });
    });
});
