import { createHmac } from 'crypto';
import { env } from '../config/env';

export function signRelanceUrl(id: string, answer: string): string {
    return createHmac('sha256', env.RELANCE_HMAC_SECRET)
        .update(`${id}:${answer}`)
        .digest('hex');
}

export function verifyRelanceUrl(id: string, answer: string, sig: string): boolean {
    const expected = signRelanceUrl(id, answer);
    return expected === sig;
}
