import { logger } from '../logger';
import { GoogleGmailService } from './gmail.service';
import { UserService } from '../../services/UserService';
import type { SendEmailOptions } from './types';

const gmailService = new GoogleGmailService();
const userService = new UserService();

const SYSTEM_EMAIL = 'dev@disciplina.re';

/**
 * Résultat d'envoi : un appelant qui a besoin de savoir si le message est
 * réellement parti (invitation émargement) doit pouvoir le distinguer d'un
 * simple « pas de boîte système configurée ».
 */
export type SystemMailResult =
    { delivered: true } | { delivered: false; reason: 'mailbox-missing' | 'no-token' | 'error' };

export async function sendSystemEmail(options: SendEmailOptions): Promise<SystemMailResult> {
    const user = await userService.findByEmail(SYSTEM_EMAIL);
    if (!user) {
        logger.warn({ email: SYSTEM_EMAIL }, `[SystemMail] ${SYSTEM_EMAIL} not found in users table — skipping email`);
        return { delivered: false, reason: 'mailbox-missing' };
    }
    if (!user.refreshToken) {
        logger.warn(
            { email: SYSTEM_EMAIL, userId: user.id },
            `[SystemMail] ${SYSTEM_EMAIL} has no Google refresh token (Google not connected) — skipping email`,
        );
        return { delivered: false, reason: 'no-token' };
    }

    try {
        await gmailService.sendEmail(
            { access_token: user.oauthToken, refresh_token: user.refreshToken },
            options,
            userService.googleTokenPersister(user.id),
        );
        logger.info({ to: options.to, subject: options.subject }, '[SystemMail] Email sent');
        return { delivered: true };
    } catch (err) {
        logger.error({ err, to: options.to, subject: options.subject }, '[SystemMail] Failed to send email');
        return { delivered: false, reason: 'error' };
    }
}
