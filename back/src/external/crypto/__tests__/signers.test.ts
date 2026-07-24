import { describe, it, expect, vi, afterEach } from 'vitest';
import { signRelanceUrl, verifyRelanceUrl, signMatchUrl, verifyMatchUrl } from '../signers';

const DAY = 24 * 60 * 60 * 1000;

// Signe à une date passée pour obtenir un lien authentiquement ancien : sans ça,
// on ne vérifierait que le rejet des ts trafiqués, jamais la borne des 30 jours.
function signRelanceAt(daysAgo: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() - daysAgo * DAY));
    const signed = signRelanceUrl('candidate-1', 'oui');
    vi.useRealTimers();
    return signed;
}

describe('signed relance urls', () => {
    afterEach(() => vi.useRealTimers());

    it('accepts a fresh link', () => {
        const { sig, ts } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, ts)).toBe(true);
    });

    it('accepts a genuinely 29-day-old link', () => {
        const { sig, ts } = signRelanceAt(29);
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, ts)).toBe(true);
    });

    it('refuses a genuinely 31-day-old link', () => {
        const { sig, ts } = signRelanceAt(31);
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, ts)).toBe(false);
    });

    it('refuses a tampered ts', () => {
        const { sig, ts } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, ts - 31 * DAY)).toBe(false);
    });

    it('refuses a ts in the future', () => {
        const { sig, ts } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, ts + DAY)).toBe(false);
    });

    it('refuses a non-numeric ts', () => {
        const { sig } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-1', 'oui', sig, Number('nope'))).toBe(false);
    });

    it('refuses a swapped answer', () => {
        const { sig, ts } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-1', 'non', sig, ts)).toBe(false);
    });

    it('refuses a swapped id', () => {
        const { sig, ts } = signRelanceUrl('candidate-1', 'oui');
        expect(verifyRelanceUrl('candidate-2', 'oui', sig, ts)).toBe(false);
    });
});

describe('signed match urls', () => {
    it('accepts a fresh link', () => {
        const { sig, ts } = signMatchUrl('offer-1', 'candidate-1', 'oui');
        expect(verifyMatchUrl('offer-1', 'candidate-1', 'oui', sig, ts)).toBe(true);
    });

    it('refuses a relance signature replayed on match', () => {
        const { sig, ts } = signRelanceUrl('offer-1', 'oui');
        expect(verifyMatchUrl('offer-1', 'oui', 'oui', sig, ts)).toBe(false);
    });

    it('refuses a swapped candidate', () => {
        const { sig, ts } = signMatchUrl('offer-1', 'candidate-1', 'oui');
        expect(verifyMatchUrl('offer-1', 'candidate-2', 'oui', sig, ts)).toBe(false);
    });
});
