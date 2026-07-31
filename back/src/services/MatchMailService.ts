import { GoogleGmailService } from '../external/google/gmail.service';
import { GoogleTokens } from '../external/google/types';
import { UserService } from './UserService';
import { SessionCredentials } from './MatchLinkService';
import { escapeHtml } from './html';
import { env } from '../config/env';
import { logger } from '../external/logger';

function invitationHtml(link: string, code: string, identifier: string): string {
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #60207E;">Sélection de candidats</h2>
            <p>Bonjour,</p>
            <p>Des candidats vous sont proposés. Cliquez sur le lien ci-dessous puis saisissez vos identifiants pour les consulter et répondre.</p>
            <p><a href="${escapeHtml(link)}" style="color: #60207E;">${escapeHtml(link)}</a></p>
            <p><strong>Identifiant :</strong> ${escapeHtml(identifier)}<br/>
               <strong>Code :</strong> ${escapeHtml(code)}</p>
            <p>Ce lien expire dans 24 heures.</p>
        </div>`;
}

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
    ) {}

    async sendInvitation(credentials: SessionCredentials): Promise<void> {
        const link = `${env.FRONTEND_BASE_URL}/public/match?sig=${credentials.signature}`;
        await this.sendAs(credentials.rhEmail, {
            to: credentials.companyEmail,
            subject: '[Disciplina] Vos candidats proposés',
            text: `Consultez vos candidats : ${link}\nIdentifiant : ${credentials.identifier}\nCode : ${credentials.code}`,
            html: invitationHtml(link, credentials.code, credentials.identifier),
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
        rhEmail: string,
        options: { to: string; subject: string; text: string; html: string },
    ): Promise<void> {
        const rh = await this.userService.findByEmail(rhEmail);
        if (!rh?.oauthToken || !rh?.refreshToken) {
            logger.warn({ rhEmail }, '[match] no Google credentials to send mail');
            return;
        }
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken };
        const persist = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        await this.gmailService.sendEmail(creds, options, persist);
    }
}
