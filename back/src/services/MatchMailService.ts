import { GoogleGmailService } from '../external/google/gmail.service';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { SessionCredentials } from './MatchLinkService';
import { MailTemplateService } from './MailTemplateService';
import { PROPOSITION_CANDIDAT_SUBJECT, PROPOSITION_CANDIDAT_BODY } from './propositionCandidatsTemplate';
import { User } from '../types/user.types';
import { escapeHtml } from './html';
import { env } from '../config/env';
import { logger } from '../external/logger';

const EXPIRATION_LABEL = '72 heures';

function lockAlertHtml(): string {
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #b00020;">Trop de tentatives</h2>
            <p>L'accès à la sélection de candidats a été bloqué après 3 tentatives incorrectes.</p>
            <p>Une nouvelle session doit être créée par votre conseiller RH.</p>
        </div>`;
}

export class MatchMailService {
    constructor(
        private readonly gmailService = new GoogleGmailService(),
        private readonly userService = new UserService(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async sendInvitation(credentials: SessionCredentials, templateId?: string): Promise<void> {
        const rh = await this.userService.findByEmail(credentials.rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail: credentials.rhEmail }, '[match] no Google credentials to send mail');
            return;
        }

        // Modèle choisi par le RH (si accessible), sinon le modèle système `proposition_candidat`.
        let tpl = templateId ? await this.mailTemplateService.findById(rh.id, templateId) : null;
        if (!tpl) tpl = await this.mailTemplateService.findRhTemplateByKind('proposition_candidat');
        const subject = tpl?.subject ?? PROPOSITION_CANDIDAT_SUBJECT;
        const body = tpl?.body ?? PROPOSITION_CANDIDAT_BODY;

        const link = `${env.FRONTEND_BASE_URL}/public/match?sig=${credentials.signature}`;
        const linkText = escapeHtml(link);
        const linkHtml = `<a href="${linkText}" style="color:#60207E;">${linkText}</a>`;
        const hrName = [rh.firstName, rh.lastName].filter(Boolean).join(' ').trim() || rh.email;
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');

        const resolvedSubject = subject.replaceAll('{{hr_name}}', escapeHtml(hrName));
        const resolvedBody = body
            .replaceAll('{{hr_name}}', escapeHtml(hrName))
            .replaceAll('{{link}}', linkHtml)
            .replaceAll('{{id}}', escapeHtml(credentials.identifier))
            .replaceAll('{{code}}', escapeHtml(credentials.code))
            .replaceAll('{{expiration time}}', EXPIRATION_LABEL)
            .replaceAll('{{hr_signature}}', signatureHtml);

        await this.sendAs(rh, {
            to: credentials.companyEmail,
            subject: resolvedSubject,
            text: resolvedBody.replace(/<[^>]*>/g, ''),
            html: resolvedBody,
        });
    }

    async sendLockAlert(rhEmail: string, companyEmail: string): Promise<void> {
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh) return;
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');
        await this.sendAs(rh, {
            to: `${companyEmail}, ${rhEmail}`,
            subject: '[Disciplina] Accès bloqué après 3 tentatives',
            text: "L'accès à la sélection de candidats a été bloqué après 3 tentatives incorrectes.",
            html: lockAlertHtml() + signatureHtml,
        });
    }

    private async sendAs(
        rh: User,
        options: { to: string; subject: string; text: string; html: string },
    ): Promise<void> {
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail: rh.email }, '[match] no Google credentials to send mail');
            return;
        }
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken };
        const persist = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        await this.gmailService.sendEmail(creds, options, persist);
    }
}
