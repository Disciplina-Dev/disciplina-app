import { Request, Response } from 'express';
import { generateSignature, timingSafeEqualString } from '../../external/crypto';
import { CSRF_COOKIE, CSRF_HEADER } from './tokenAuth';

export function issueCsrfCookie(): string {
    return generateSignature();
}

// Double-submit cookie : le cookie disc_csrf (lisible en JS) doit être renvoyé
// tel quel dans l'en-tête X-CSRF-Token par le client. Un attaquant cross-site
// ne peut pas lire le cookie pour le rejouer dans l'en-tête.
export function isCsrfValid(req: Request): boolean {
    const cookieValue = req.cookies?.[CSRF_COOKIE];
    const headerValue = req.headers[CSRF_HEADER];
    if (!cookieValue || typeof headerValue !== 'string') return false;
    return timingSafeEqualString(cookieValue, headerValue);
}

export function rejectCsrf(res: Response): void {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
}
