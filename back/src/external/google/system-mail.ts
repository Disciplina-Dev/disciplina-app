import { logger } from '../logger';
import { GoogleGmailService } from './gmail.service';
import { UserService } from '../../services/UserService';
import type { SendEmailOptions } from './types';

const gmailService = new GoogleGmailService();
const userService = new UserService();

const SYSTEM_EMAIL = 'hivanhoeq@gmail.com';

export async function sendSystemEmail(options: SendEmailOptions): Promise<void> {
    const user = await userService.findByEmail(SYSTEM_EMAIL);
    if (!user) {
        logger.warn({ email: SYSTEM_EMAIL }, `[SystemMail] ${SYSTEM_EMAIL} not found in users table — skipping email`);
        return;
    }
    if (!user.refreshToken) {
        logger.warn(
            { email: SYSTEM_EMAIL, userId: user.id },
            `[SystemMail] ${SYSTEM_EMAIL} has no Google refresh token (Google not connected) — skipping email`,
        );
        return;
    }

    try {
        await gmailService.sendEmail(
            { access_token: user.oauthToken, refresh_token: user.refreshToken },
            options,
            userService.googleTokenPersister(user.id),
        );
        logger.info({ to: options.to, subject: options.subject }, '[SystemMail] Email sent');
    } catch (err) {
        logger.error({ err, to: options.to, subject: options.subject }, '[SystemMail] Failed to send email');
    }
}
