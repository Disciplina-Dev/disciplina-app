import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { escapeHtml } from './html';
import { env } from '../config/env';
import { logger } from '../external/logger';

function interviewInvitationHtml(link: string, code: string, companyName: string): string {
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #60207E;">Choisissez votre créneau d'entretien</h2>
            <p>Bonjour,</p>
            <p>${escapeHtml(
                companyName,
            )} souhaite vous rencontrer. Cliquez sur le lien ci-dessous puis saisissez votre code pour choisir votre créneau d'entretien.</p>
            <p><a href="${escapeHtml(link)}" style="color: #60207E;">${escapeHtml(link)}</a></p>
            <p><strong>Code :</strong> ${escapeHtml(code)}</p>
            <p>Ce lien expire dans 7 jours.</p>
        </div>`;
}

export class InterviewMailService {
    constructor(
        private readonly gmailService = new GoogleGmailService(),
        private readonly userService = new UserService(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async sendInvitation(
        rhEmail: string,
        candidateEmail: string,
        companyName: string,
        signature: string,
        code: string,
    ): Promise<void> {
        const link = `${env.FRONTEND_BASE_URL}/public/interview?sig=${signature}`;
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail }, '[interview] no Google credentials to send mail');
            return;
        }
        const mailSignatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken };
        const persist = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        await this.gmailService.sendEmail(
            creds,
            withNoReply({
                to: candidateEmail,
                subject: "[Disciplina] Choisissez votre créneau d'entretien",
                text: `Choisissez votre créneau : ${link}\nCode : ${code}`,
                html: interviewInvitationHtml(link, code, companyName) + mailSignatureHtml,
            }),
            persist,
        );
    }
}
