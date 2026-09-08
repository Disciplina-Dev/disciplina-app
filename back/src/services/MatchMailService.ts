import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { PROPOSITION_CANDIDAT_SUBJECT, PROPOSITION_CANDIDAT_BODY } from './propositionCandidatsTemplate';
import { User } from '../types/user.types';
import { escapeHtml } from './html';
import { logger } from '../external/logger';

function lockAlertHtml(): string {
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #b00020;">Trop de tentatives</h2>
            <p>L'accès à la sélection de candidats a été bloqué après 3 tentatives incorrectes.</p>
            <p>Une nouvelle session doit être créée par votre conseiller RH.</p>
        </div>`;
}

export interface MatchInvitation {
    signature: string;
    link: string;
    rhEmail: string;
    companyEmail: string;
}

export class MatchMailService {
    constructor(
        private readonly gmailService = new GoogleGmailService(),
        private readonly userService = new UserService(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async sendInvitation(invitation: MatchInvitation, templateId?: string): Promise<void> {
        const rh = await this.userService.findByEmail(invitation.rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail: invitation.rhEmail }, '[match] no Google credentials to send mail');
            return;
        }

        // Modèle choisi par le RH (si accessible), sinon le modèle système `proposition_candidat`.
        let tpl = templateId ? await this.mailTemplateService.findById(rh.id, templateId) : null;
        if (!tpl) tpl = await this.mailTemplateService.findRhTemplateByKind('proposition_candidat');
        const subject = tpl?.subject ?? PROPOSITION_CANDIDAT_SUBJECT;
        const body = tpl?.body ?? PROPOSITION_CANDIDAT_BODY;

        const linkText = escapeHtml(invitation.link);
        const linkHtml =
            `<a href="${linkText}" style="display:inline-block;background-color:#60207E;color:#fff;` +
            `padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Accéder à la sélection</a>`;
        const hrName = [rh.firstName, rh.lastName].filter(Boolean).join(' ').trim() || rh.email;
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');

        const resolvedSubject = subject.replaceAll('{{hr_name}}', escapeHtml(hrName));
        let resolvedBody = body
            .replaceAll('{{hr_name}}', escapeHtml(hrName))
            .replaceAll('{{link}}', linkHtml)
            .replaceAll('{{expiration time}}', '')
            .replaceAll('{{hr_signature}}', signatureHtml)
            // Code/identifiant retirés : le code est envoyé séparément au chargement de la page.
            .replaceAll('{{code}}', '')
            .replaceAll('{{id}}', '');

        // Sécurité : l'entreprise doit toujours recevoir le lien, même si le modèle
        // édité a supprimé {{link}}.
        if (!resolvedBody.includes(invitation.link)) {
            resolvedBody += `<p style="text-align:center;margin:24px 0">${linkHtml}</p>`;
        }

        await this.sendAs(rh, {
            to: invitation.companyEmail,
            subject: resolvedSubject,
            text: resolvedBody.replace(/<[^>]*>/g, ''),
            html: resolvedBody,
        });
    }

    async sendLockAlert(rhEmail: string | null, companyEmail: string | null): Promise<void> {
        if (!rhEmail) return;
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh) return;
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(rh.id, 'rh').catch(() => '');
        await this.sendAs(rh, {
            to: [companyEmail, rhEmail].filter(Boolean).join(', '),
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
        await this.gmailService.sendEmail(creds, withNoReply(options), persist);
    }
}