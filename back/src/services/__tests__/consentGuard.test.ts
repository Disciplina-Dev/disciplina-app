import { describe, it, expect, vi } from 'vitest';
import { hasConsent, assertConsent, ConsentType } from '../consentGuard';
import { logger } from '../../external/logger';

describe('consentGuard', () => {
    describe('hasConsent', () => {
        it('is true when every required consent is granted', () => {
            const candidate = { consentments: { ai_processing: true, data_processing: true } };
            expect(hasConsent(candidate as any, [ConsentType.AI_PROCESSING, ConsentType.DATA_PROCESSING])).toBe(true);
        });

        it('is false when one required consent is missing', () => {
            const candidate = { consentments: { ai_processing: false, data_processing: true } };
            expect(hasConsent(candidate as any, [ConsentType.AI_PROCESSING, ConsentType.DATA_PROCESSING])).toBe(false);
        });

        it('is false when consentments is undefined', () => {
            const candidate = { consentments: undefined };
            expect(hasConsent(candidate as any, [ConsentType.AI_PROCESSING])).toBe(false);
        });
    });

    describe('assertConsent', () => {
        it('does not throw when consent is granted, regardless of mode', () => {
            const candidate = { consentments: { ai_processing: true } };
            expect(() => assertConsent(candidate as any, [ConsentType.AI_PROCESSING], { mode: 'block' })).not.toThrow();
            expect(() => assertConsent(candidate as any, [ConsentType.AI_PROCESSING], { mode: 'warn' })).not.toThrow();
        });

        it('throws in block mode when consent is missing', () => {
            const candidate = { consentments: { ai_processing: false } };
            expect(() => assertConsent(candidate as any, [ConsentType.AI_PROCESSING], { mode: 'block' })).toThrow(
                /ai_processing/,
            );
        });

        it('logs a warning but does not throw in warn mode when consent is missing', () => {
            const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined as any);
            const candidate = { consentments: { ai_processing: false } };

            expect(() => assertConsent(candidate as any, [ConsentType.AI_PROCESSING], { mode: 'warn' })).not.toThrow();
            expect(warnSpy).toHaveBeenCalledWith(
                { required: [ConsentType.AI_PROCESSING] },
                'Candidate missing consent, allowed under warn-only grace period',
            );

            warnSpy.mockRestore();
        });
    });
});
