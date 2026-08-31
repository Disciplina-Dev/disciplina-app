import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { INTERVIEW_INVITATION_SUBJECT, INTERVIEW_INVITATION_BODY } from './interviewInvitationTemplate';
import { User } from '../types/user.types';
import { escapeHtml } from './html';
import { env } from '../config/env';
import { logger } from '../external/logger';

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
    ): Promise<void> {
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail }, '[interview] no Google credentials to send mail');
            return;
        }

        // Modèle système « Invitation entretien » (éditable dans « Modèles mail »),
        // sinon le modèle par défaut.
        const tpl = await this.mailTemplateService.findRhTemplateByKind('interview_invitation');
        const subject = tpl?.subject ?? INTERVIEW_INVITATION_SUBJECT;
        const body = tpl?.body ?? INTERVIEW_INVITATION_BODY;

        const link = `${env.FRONTEND_BASE_URL}/external/authenticate?sig=${signature}`;
        const linkText = escapeHtml(link);
        const linkHtml =
            `<a href="${linkText}" style="display:inline-block;background-color:#60207E;color:#fff;` +
            `padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Choisir mon créneau</a>`;
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');

        // Le code est généré et envoyé au chargement de la page : on retire du mail
        // un éventuel {{code}} laissé par un modèle édité.
        const resolvedSubject = subject.replaceAll('{{code}}', '');
        let resolvedBody = body
            .replaceAll('{{company_name}}', escapeHtml(companyName))
            .replaceAll('{{link}}', linkHtml)
            .replaceAll('{{code}}', '')
            .replaceAll('{{hr_signature}}', signatureHtml);

        // Sécurité : le candidat doit toujours recevoir le bouton, même si le modèle
        // édité a supprimé {{link}}.
        if (!resolvedBody.includes(link)) {
            resolvedBody += `<p style="text-align:center;margin:24px 0">${linkHtml}</p>`;
        }

        await this.sendAs(rh, {
            to: candidateEmail,
            subject: resolvedSubject,
            text: resolvedBody.replace(/<[^>]*>/g, ''),
            html: resolvedBody,
        });
    }

    private async sendAs(
        rh: User,
        options: { to: string; subject: string; text: string; html: string },
    ): Promise<void> {
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail: rh.email }, '[interview] no Google credentials to send mail');
            return;
        }
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken };
        const persist = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        await this.gmailService.sendEmail(creds, withNoReply(options), persist);
    }
}