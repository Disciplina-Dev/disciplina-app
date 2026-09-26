import { GoogleGmailService } from '../external/google/gmail.service';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { logger } from '../external/logger';

export class ExternalMailService {
    constructor(
        private readonly gmailService = new GoogleGmailService(),
        private readonly userService = new UserService(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async sendMail(
        rhEmail: string,
        options: {
            to: string;
            subject: string;
            html: string;
            text?: string;
            attachments?: { filename: string; content: string; contentType?: string }[];
        },
    ): Promise<void> {
        await this.sendAs(rhEmail, {
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
            attachments: options.attachments,
        });
    }

    private async sendAs(
        rhEmail: string,
        options: {
            to: string;
            subject: string;
            text: string;
            html: string;
            attachments?: { filename: string; content: string; contentType?: string }[];
        },
    ): Promise<void> {
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail }, '[external] no Google credentials to send mail');
            return;
        }
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken };
        const persist = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        await this.gmailService.sendEmail(creds, { ...options, html: options.html + signatureHtml }, persist);
    }
}
