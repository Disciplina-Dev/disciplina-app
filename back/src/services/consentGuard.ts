import { Candidate } from '../types/candidate.types';
import { logger } from '../external/logger';

export enum ConsentType {
    DATA_PROCESSING = 'data_processing',
    DATA_SHARING = 'data_sharing',
    AI_PROCESSING = 'ai_processing',
    PHOTO_PROCESSING = 'photo_processing',
}

export function hasConsent(candidate: Pick<Candidate, 'consentments'>, required: ConsentType[]): boolean {
    return required.every((type) => candidate.consentments?.[type] === true);
}

/**
 * 'warn' allows the action but logs, for candidates recorded before consent
 * enforcement existed. Flip call sites to 'block' once backfill/re-consent
 * is confirmed.
 */
export function assertConsent(
    candidate: Pick<Candidate, 'consentments'>,
    required: ConsentType[],
    opts: { mode: 'block' | 'warn' },
): void {
    if (hasConsent(candidate, required)) {
        return;
    }

    if (opts.mode === 'warn') {
        logger.warn({ required }, 'Candidate missing consent, allowed under warn-only grace period');
        return;
    }

    throw new Error(`Candidate does not consent to: ${required.join(', ')}`);
}
