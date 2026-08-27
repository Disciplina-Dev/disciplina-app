import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { withNoReply } from '../external/google/no-reply';
import { AB_RELANCE_SUBJECT, AB_RELANCE_BODY } from './abRelanceTemplate';
import { NeedsAnalysis } from '../types/needsAnalysisNoSql.types';
import { logger } from '../external/logger';

/** Délai avant relance : 2 semaines après l'envoi en signature. */
export const AB_RELANCE_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

/** Échappe le texte injecté dans le HTML d'un mail (nom d'entreprise, etc.). */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Relance automatique des AB envoyées en signature mais toujours non signées :
 * pour toute AB en EN_ATTENTE_SIGNATURE depuis au moins 2 semaines et non encore
 * relancée, renvoie au responsable recrutement un mail « AB à signer » (modèle
 * système `ab_relance`) avec le lien DocuSeal, via le Gmail du commercial.
 *
 * Relance unique : la dédup repose sur `last_relance_at` — une fois le mail
 * envoyé, l'AB est marquée et ne repasse plus dans la sélection.
 */
export class AbSignatureRelanceService {
    private repository = new NeedsAnalysisRepository();
    private userService = new UserService();
    private mailTemplateService = new MailTemplateService();
    private gmailService = new GoogleGmailService();

    async run(now: Date = new Date()): Promise<number> {
        const due = await this.repository.findDueSignatureRelance(now, AB_RELANCE_DELAY_MS);
        if (due.length === 0) return 0;

        let relanced = 0;
        for (const ab of due) {
            try {
                await this.relanceOne(ab, now);
                relanced += 1;
            } catch (err) {
                // On isole l'échec d'une AB : les autres doivent être traitées.
                // Non marquée → nouvelle tentative au prochain tick.
                logger.error({ err, abId: ab._id }, 'ab-relance: échec envoi relance signature');
            }
        }
        return relanced;
    }

    private async relanceOne(ab: NeedsAnalysis, now: Date): Promise<void> {
        const signerEmail = ab.referents?.recruitment_referents?.email;
        if (!signerEmail) {
            throw new Error('No recruitment responsible email to send the relance to');
        }
        const signUrl = ab.signature_url;
        if (!signUrl) {
            throw new Error('No stored signature link to build the relance');
        }
        const salerId = ab.saler_info?.id;
        if (!salerId) {
            throw new Error('No saler attached to the AB');
        }
        const saler = await this.userService.findById(salerId);
        if (!saler?.oauthToken) {
            throw new Error('Saler Google account not connected');
        }

        const companyName = ab.company_infos?.name || 'votre entreprise';
        const { subject, body } = await this.buildRelanceEmail(salerId, companyName, signUrl);

        await this.gmailService.sendEmail(
            { access_token: saler.oauthToken, refresh_token: saler.refreshToken ?? undefined },
            withNoReply({ to: signerEmail, subject, html: body, text: body.replace(/<[^>]*>/g, '') }),
            this.userService.googleTokenPersister(salerId),
        );

        await this.repository.update(ab._id!, { last_relance_at: now });
    }

    /**
     * Construit le mail de relance depuis le modèle système `ab_relance` (sinon
     * le défaut), en remplaçant {{entreprise}}, {{lien_signature}} (bouton) et
     * {{signature}}.
     */
    private async buildRelanceEmail(
        userId: number,
        companyName: string,
        signUrl: string,
    ): Promise<{ subject: string; body: string }> {
        const tpl = await this.mailTemplateService.findCommercialTemplateByKind('ab_relance');
        const subject = tpl?.subject ?? AB_RELANCE_SUBJECT;
        let body = tpl?.body ?? AB_RELANCE_BODY;

        const signatureHtml = await this.mailTemplateService.getSignatureHtml(userId, 'commercial').catch(() => '');
        const button =
            `<a href="${signUrl}" style="display:inline-block;background:#2563eb;color:#fff;` +
            `padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Signer les documents</a>`;

        const fillVars = (text: string, allowLink: boolean): string => {
            let out = text
                .replaceAll('{{entreprise}}', escapeHtml(companyName))
                .replaceAll('{{signature}}', allowLink ? signatureHtml : '');
            out = allowLink ? out.replaceAll('{{lien_signature}}', button) : out.replaceAll('{{lien_signature}}', '');
            return out;
        };

        body = fillVars(body, true);
        // Sécurité : le signataire doit toujours avoir le lien, même si le modèle
        // édité a supprimé {{lien_signature}}.
        if (!body.includes(signUrl)) {
            body += `<p>${button}</p>`;
        }
        return { subject: fillVars(subject, false), body };
    }
}
