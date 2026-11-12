import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../repositories/mongo/AlternantSequenceRepository';
import { UserService } from './UserService';
import { MailTemplateService } from './MailTemplateService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { NO_REPLY_FOOTER_HTML, NO_REPLY_FOOTER_TEXT, withNoReply } from '../external/google/no-reply';
import { signRelanceUrl } from '../external/crypto';
import { env } from '../config/env';
import { JobRole } from '../types/user.types';
import { AlternantSequence } from '../types/alternant.types';
import { logger } from '../external/logger';

/** Fenêtre d'envoi de la proposition de RDV avant chaque SA (#961) : 2 à 3 semaines avant. */
export const SA_APPOINTMENT_WINDOW_MIN_DAYS = 14;
export const SA_APPOINTMENT_WINDOW_MAX_DAYS = 21;

function formatDateFr(iso: Date | string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Propose par mail une date de RDV au maître d'apprentissage, 2 à 3 semaines
 * avant chaque SA, avec un lien de confirmation signé (#961 — point 1).
 * Envoyée depuis le compte Google du premier utilisateur Peda connecté : il
 * n'existe pas aujourd'hui de notion de « péda référent » par alternant.
 */
export class SaAppointmentService {
    constructor(
        private readonly sequences = new AlternantSequenceRepository(),
        private readonly alternants = new AlternantRepository(),
        private readonly users = new UserService(),
        private readonly mailTemplateService = new MailTemplateService(),
        private readonly gmail = new GoogleGmailService(),
    ) {}

    async run(now: Date = new Date()): Promise<{ proposed: number }> {
        const windowStart = new Date(now.getTime() + SA_APPOINTMENT_WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + SA_APPOINTMENT_WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000);
        const candidates = await this.sequences.findAppointmentProposalCandidates(windowStart, windowEnd);
        if (candidates.length === 0) return { proposed: 0 };

        const sender = await this.findSender();
        if (!sender) {
            logger.warn('sa-appointments: aucun compte Google Peda connecté, propositions ignorées');
            return { proposed: 0 };
        }
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(sender.id, 'peda').catch(() => '');

        let proposed = 0;
        for (const seq of candidates) {
            try {
                const sent = await this.proposeAppointment(seq, sender, signatureHtml);
                if (sent) proposed += 1;
            } catch (err) {
                logger.error({ err, sequenceId: seq._id }, 'sa-appointments: échec envoi proposition de RDV');
            }
        }
        return { proposed };
    }

    /** Premier utilisateur Peda avec un compte Google connecté. */
    private async findSender(): Promise<{ id: number; oauthToken: string; refreshToken: string | null } | null> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        const connected = pedas.find((u) => u.oauthToken);
        if (!connected?.oauthToken) return null;
        return { id: connected.id, oauthToken: connected.oauthToken, refreshToken: connected.refreshToken ?? null };
    }

    private async proposeAppointment(
        seq: AlternantSequence,
        sender: { id: number; oauthToken: string; refreshToken: string | null },
        signatureHtml: string,
    ): Promise<boolean> {
        const alternant = await this.alternants.findById(seq.alternant_id);
        const mentorEmail = alternant?.company?.mentor_email?.trim();
        // Pas d'email de mentor : on ne marque pas comme proposée, pour retenter
        // dès qu'il sera renseigné (tant que la SA reste dans la fenêtre).
        if (!alternant || alternant.archived_at != null || !mentorEmail) return false;

        const mentorName = alternant.company?.mentor_name?.trim() || 'Madame, Monsieur';
        const alternantName = `${alternant.first_name} ${alternant.last_name}`.trim();
        const date = formatDateFr(seq.prevue_le);
        const confirm = signRelanceUrl(seq._id, 'confirm');
        const confirmUrl = `${env.APP_BASE_URL}/api/peda/sa-appointment/response?id=${seq._id}&answer=confirm&sig=${confirm.sig}&ts=${confirm.ts}`;

        const html = `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Bonjour ${mentorName},</p>
  <p>Nous souhaitons organiser prochainement une séquence d'accompagnement avec ${alternantName}, actuellement en alternance dans votre entreprise.</p>
  <p>Date proposée : <strong>${date}</strong>.</p>
  <p>
    <a href="${confirmUrl}" style="display:inline-block;background:#0f6e63;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Confirmer cette date</a>
  </p>
  <p>Si cette date ne vous convient pas, n'hésitez pas à nous recontacter directement pour en fixer une autre.</p>
  <p>Cordialement,<br>L'équipe DISCIPLINA${signatureHtml}</p>
  ${NO_REPLY_FOOTER_HTML}
</div>`;
        const text = `Bonjour ${mentorName},\n\nNous souhaitons organiser prochainement une séquence d'accompagnement avec ${alternantName}.\n\nDate proposée : ${date}.\n\nConfirmer : ${confirmUrl}\n\nCordialement,\nL'équipe DISCIPLINA${NO_REPLY_FOOTER_TEXT}`;

        await this.gmail.sendEmail(
            { access_token: sender.oauthToken, refresh_token: sender.refreshToken ?? undefined },
            withNoReply({
                to: mentorEmail,
                subject: `Proposition de date — séquence d'accompagnement de ${alternantName}`,
                html,
                text,
            }),
            this.users.googleTokenPersister(sender.id),
        );
        await this.sequences.markAppointmentProposed(seq._id, new Date());
        return true;
    }

    /** Appelée par le lien signé du mail (#961) — jamais par un utilisateur authentifié. */
    async confirm(sequenceId: string): Promise<boolean> {
        const seq = await this.sequences.findById(sequenceId);
        if (!seq) return false;
        await this.sequences.markAppointmentConfirmed(sequenceId, new Date());
        return true;
    }
}
