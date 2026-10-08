import { describe, it, expect } from 'vitest';
import { buildSaDates, inferLegacyType } from '../AlternantService';
import { AlternantSequenceType } from '../../types/alternant.types';

describe('buildSaDates (#888 type tagging)', () => {
    it('tags j15/j10w/periodique in order for a long contract', () => {
        const dates = buildSaDates(new Date('2026-09-01'), new Date('2027-06-30'));
        expect(dates.map((d) => d.type)).toEqual([
            AlternantSequenceType.J15,
            AlternantSequenceType.J10W,
            AlternantSequenceType.PERIODIQUE,
        ]);
    });

    it('omits j15/j10w entirely for a contract shorter than 15 days — no positional ambiguity', () => {
        const dates = buildSaDates(new Date('2026-09-01'), new Date('2026-09-05'));
        expect(dates).toEqual([]);
    });

    it('produces only a j15 when the contract ends between 15 and 70 days', () => {
        const dates = buildSaDates(new Date('2026-09-01'), new Date('2026-09-20'));
        expect(dates.map((d) => d.type)).toEqual([AlternantSequenceType.J15]);
    });

    it('without an end date, generates exactly 3: j15, j10w, periodique', () => {
        const dates = buildSaDates(new Date('2026-09-01'));
        expect(dates.map((d) => d.type)).toEqual([
            AlternantSequenceType.J15,
            AlternantSequenceType.J10W,
            AlternantSequenceType.PERIODIQUE,
        ]);
    });
});

describe('inferLegacyType (#888 backfill heuristic)', () => {
    it('returns the stored type when present, ignoring numero/auto_generated', () => {
        expect(inferLegacyType({ type: AlternantSequenceType.PERIODIQUE, numero: 1, auto_generated: true })).toBe(
            AlternantSequenceType.PERIODIQUE,
        );
    });

    it('infers j15 for auto-generated numero 1 without a stored type', () => {
        expect(inferLegacyType({ numero: 1, auto_generated: true })).toBe(AlternantSequenceType.J15);
    });

    it('infers j10w for auto-generated numero 2 without a stored type', () => {
        expect(inferLegacyType({ numero: 2, auto_generated: true })).toBe(AlternantSequenceType.J10W);
    });

    it('infers periodique for a manual sequence regardless of numero', () => {
        expect(inferLegacyType({ numero: 1, auto_generated: false })).toBe(AlternantSequenceType.PERIODIQUE);
    });

    it('infers periodique for auto-generated numero 3+', () => {
        expect(inferLegacyType({ numero: 3, auto_generated: true })).toBe(AlternantSequenceType.PERIODIQUE);
    });
});
