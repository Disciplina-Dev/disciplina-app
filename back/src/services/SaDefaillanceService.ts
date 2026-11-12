import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { UserService } from './UserService';
import { NotificationService } from './NotificationService';
import { MailTemplateService } from './MailTemplateService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { NO_REPLY_FOOTER_HTML, NO_REPLY_FOOTER_TEXT, withNoReply } from '../external/google/no-reply';
import { JobRole, Permission, User } from '../types/user.types';
import { Alternant, AlternantCompanyDefaillance } from '../types/alternant.types';
import { logger } from '../external/logger';

/** Délais de l'escalade « entreprise défaillante » (#961 — point 6), non fournis par l'issue. */
export const DEFAILLANCE_ALERT_DAYS = 7;
export const DEFAILLANCE_ESCALATION_DAYS = 14;

type Sender = { id: number; oauthToken: string; refreshToken: string | null };

/**
 * Suivi d'une entreprise défaillante, déclarée manuellement par un péda sur la
 * fiche alternant (#961 — point 6). Escalade en 3 temps, chaque palier annulé
 * dès que `resolve()` est appelé :
 * 1. Rappel écrit au mentor, envoyé immédiatement par `report()`.
 * 2. Courrier d'alerte envoyé par un péda Responsable, à J+{@link DEFAILLANCE_ALERT_DAYS}.
 * 3. Notification interne (pas un mail) à la Direction et au Commercial, à
 *    J+{@link DEFAILLANCE_ESCALATION_DAYS}.
 */
export class SaDefaillanceService {
    constructor(
        private readonly alternants = new AlternantRepository(),
        private readonly users = new UserService(),
        private readonly notifications = new NotificationService(),
        private readonly mailTemplateService = new MailTemplateService(),
        private readonly gmail = new GoogleGmailService(),
    ) {}

    /** Déclare l'entreprise défaillante et envoie tout de suite le rappel écrit au mentor. */
    async report(alternantId: string, reason: string): Promise<AlternantCompanyDefaillance> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw new Error('Alternant introuvable');

        const now = new Date();
        const sender = await this.findFirstConnectedPeda();
        const sent = sender ? await this.sendToMentor(alternant, sender, 'reminder') : false;
        if (!sender) logger.warn({ alternantId }, 'sa-defaillance: aucun compte Google Peda connecté, rappel ignoré');

        const defaillance: AlternantCompanyDefaillance = {
            reason,
            reported_at: now,
            reminder_sent_at: sent ? now : null,
            alert_sent_at: null,
            escalated_at: null,
            resolved_at: null,
        };
        await this.alternants.setDefaillance(alternantId, defaillance);
        return defaillance;
    }

    /** Résout la défaillance en cours : stoppe l'escalade. */
    async resolve(alternantId: string): Promise<boolean> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant?.defaillance) return false;
        await this.alternants.setDefaillance(alternantId, { ...alternant.defaillance, resolved_at: new Date() });
        return true;
    }

    /** Tick planificateur : courrier d'alerte à J+7, escalade interne à J+14. */
    async run(now: Date = new Date()): Promise<{ alerted: number; escalated: number }> {
        const alertCutoff = new Date(now.getTime() - DEFAILLANCE_ALERT_DAYS * 24 * 60 * 60 * 1000);
        const escalationCutoff = new Date(now.getTime() - DEFAILLANCE_ESCALATION_DAYS * 24 * 60 * 60 * 1000);

        let alerted = 0;
        const alertCandidates = await this.alternants.findDefaillanceAlertCandidates(alertCutoff);
        if (alertCandidates.length > 0) {
            const responsable = await this.findResponsable();
            for (const alternant of alertCandidates) {
                try {
                    if (responsable && (await this.sendToMentor(alternant, responsable, 'alert'))) {
                        await this.alternants.markDefaillanceAlertSent(alternant._id, now);
                        alerted += 1;
                    }
                } catch (err) {
                    logger.error({ err, alternantId: alternant._id }, "sa-defaillance: échec envoi courrier d'alerte");
                }
            }
        }

        let escalated = 0;
        for (const alternant of await this.alternants.findDefaillanceEscalationCandidates(escalationCutoff)) {
            try {
                await this.escalateToDirection(alternant, now);
                escalated += 1;
            } catch (err) {
                logger.error(
                    { err, alternantId: alternant._id },
                    'sa-defaillance: échec escalade Direction/Commercial',
                );
            }
        }

        return { alerted, escalated };
    }

    /** Premier péda avec un compte Google connecté — pour le rappel écrit. */
    private async findFirstConnectedPeda(): Promise<Sender | null> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        return this.toSender(pedas.find((u) => u.oauthToken));
    }

    /** Premier péda Responsable (avec compte Google connecté) — pour le courrier d'alerte. */
    private async findResponsable(): Promise<Sender | null> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        return this.toSender(pedas.find((u) => u.permission === Permission.RESPONSABLE && u.oauthToken));
    }

    private toSender(user: User | undefined): Sender | null {
        if (!user?.oauthToken) return null;
        return { id: user.id, oauthToken: user.oauthToken, refreshToken: user.refreshToken ?? null };
    }

    private async sendToMentor(alternant: Alternant, sender: Sender, kind: 'reminder' | 'alert'): Promise<boolean> {
        const mentorEmail = alternant.company?.mentor_email?.trim();
        if (!mentorEmail) return false;

        const mentorName = alternant.company?.mentor_name?.trim() || 'Madame, Monsieur';
        const alternantName = `${alternant.first_name} ${alternant.last_name}`.trim();
        const signatureHtml = await this.mailTemplateService.getSignatureHtml(sender.id, 'peda').catch(() => '');

        const subject =
            kind === 'reminder'
                ? `Rappel — suivi de l'alternance de ${alternantName}`
                : `Alerte — suivi de l'alternance de ${alternantName}`;
        const intro =
            kind === 'reminder'
                ? `Nous n'avons pas pu organiser le suivi prévu de ${alternantName} dans votre entreprise. Merci de nous recontacter afin de reprendre le lien.`
                : `Malgré notre précédent message, nous n'avons toujours pas de nouvelles concernant le suivi de ${alternantName}. Merci de nous recontacter dans les plus brefs délais.`;

        const html = `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Bonjour ${mentorName},</p>
  <p>${intro}</p>
  <p>Cordialement,<br>L'équipe DISCIPLINA${signatureHtml}</p>
  ${NO_REPLY_FOOTER_HTML}
</div>`;
        const text = `Bonjour ${mentorName},\n\n${intro}\n\nCordialement,\nL'équipe DISCIPLINA${NO_REPLY_FOOTER_TEXT}`;

        await this.gmail.sendEmail(
            { access_token: sender.oauthToken, refresh_token: sender.refreshToken ?? undefined },
            withNoReply({ to: mentorEmail, subject, html, text }),
            this.users.googleTokenPersister(sender.id),
        );
        return true;
    }

    /** Notification interne (pas de mail) à la Direction et au Commercial. */
    private async escalateToDirection(alternant: Alternant, now: Date): Promise<void> {
        const recipients: User[] = await this.users.findByJobRoles([JobRole.AD, JobRole.COMMERCIAL]);
        const companyName = alternant.company?.name?.trim() || 'Entreprise inconnue';
        const alternantName = `${alternant.first_name} ${alternant.last_name}`.trim();
        await Promise.all(
            recipients.map((u) =>
                this.notifications.create({
                    userId: u.id,
                    type: 'company_defaillante_escalated',
                    category: 'company',
                    level: 'error',
                    title: `Entreprise défaillante : ${companyName}`,
                    message: `${companyName} n'a pas répondu depuis plus de ${DEFAILLANCE_ESCALATION_DAYS} jours concernant le suivi de ${alternantName}.`,
                    link: `/peda/alternants/${alternant._id}`,
                }),
            ),
        );
        await this.alternants.markDefaillanceEscalated(alternant._id, now);
    }
}
