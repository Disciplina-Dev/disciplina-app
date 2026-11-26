import { describe, it, expect } from 'vitest';
import { reconcileEvents } from '../ConsentHistoryService';
import { ConsentType } from '../consentGuard';

/** Logique de reprise / réconciliation de src/cli/backfillConsentHistory.ts (GDPR_INF_08.2). */
describe('reconcileEvents', () => {
    const now = new Date('2026-11-19T10:00:00.000Z');
    const snapshot = {
        data_processing: true,
        data_sharing: false,
        ai_processing: true,
        photo_processing: false,
        consent_version: 'legacy-backfill',
        consent_date: new Date('2026-03-01T08:00:00.000Z'),
    };

    it('backfills granted consents dated from the candidate consent_date when there is no history', () => {
        const events = reconcileEvents('c1', snapshot, undefined, now);
        expect(events.map((e) => e.consentType).sort()).toEqual(['ai_processing', 'data_processing']);
        for (const e of events) {
            expect(e).toMatchObject({
                action: 'GRANT',
                source: 'BACKFILL',
                recordedBy: null,
                consentVersion: 'legacy-backfill',
            });
            expect(e.recordedAt).toEqual(snapshot.consent_date);
        }
    });

    it('falls back to now when consent_date is missing or invalid', () => {
        const events = reconcileEvents('c1', { ...snapshot, consent_date: 'garbage' }, undefined, now);
        expect(events.every((e) => e.recordedAt === now)).toBe(true);
    });

    it('returns nothing when the history already matches the candidate', () => {
        const latest = new Map([
            [ConsentType.DATA_PROCESSING, 'GRANT' as const],
            [ConsentType.AI_PROCESSING, 'GRANT' as const],
            [ConsentType.DATA_SHARING, 'WITHDRAW' as const],
        ]);
        expect(reconcileEvents('c1', snapshot, latest, now)).toEqual([]);
    });

    it('emits corrections dated now when the history diverges', () => {
        // Historique : ai encore accordé, photo accordée ; fiche : ai accordé, photo retirée.
        const latest = new Map([
            [ConsentType.DATA_PROCESSING, 'GRANT' as const],
            [ConsentType.AI_PROCESSING, 'GRANT' as const],
            [ConsentType.PHOTO_PROCESSING, 'GRANT' as const],
        ]);
        const events = reconcileEvents('c1', snapshot, latest, now);
        expect(events).toEqual([
            expect.objectContaining({
                consentType: 'photo_processing',
                action: 'WITHDRAW',
                source: 'BACKFILL',
                recordedAt: now,
            }),
        ]);
    });

    it('ignores candidates without consentments', () => {
        expect(reconcileEvents('c1', undefined, undefined, now)).toEqual([]);
    });
});
