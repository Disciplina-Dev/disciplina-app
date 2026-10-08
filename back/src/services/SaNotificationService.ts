import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../repositories/mongo/AlternantSequenceRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { AlternantSequence } from '../types/alternant.types';
import { UserRowJoined } from '../types/db-rows.types';
import { logger } from '../external/logger/logger';

/** Seuil « En cours » : SA prévue dans moins de 14 jours (aligné sur DashboardPeda). */
export const SA_SOON_THRESHOLD_DAYS = 14;

export interface SaNotificationCounts {
    soon: number;
    late: number;
}

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDateFr(iso: Date | string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Émet une notification aux utilisateurs Peda quand une SA entre pour la
 * première fois dans la fenêtre « En cours » (moins de 14 jours) ou devient
 * « En retard » (date prévue dépassée).
 *
 * La déduplication repose sur `sequence.soon_notified_at` /
 * `sequence.late_notified_at` : chaque transition n'est notifiée qu'une fois,
 * quel que soit le nombre de ticks. Seules les SA en attente et non archivées
 * sont prises en compte (même périmètre que le dashboard Peda).
 */
export class SaNotificationService {
    private sequences = new AlternantSequenceRepository();
    private alternants = new AlternantRepository();
    private userRepository = new UserRepository();
    private notificationService = new NotificationService();

    async run(now: Date = new Date()): Promise<SaNotificationCounts> {
        const startOfToday = startOfDay(now);
        const soonUpper = new Date(startOfToday.getTime() + SA_SOON_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
        const [soon, late] = await Promise.all([
            this.sequences.findSoonUnnotified(startOfToday, soonUpper),
            this.sequences.findLateUnnotified(startOfToday),
        ]);
        if (soon.length === 0 && late.length === 0) return { soon: 0, late: 0 };

        const recipients = await this.findPedaRecipients();
        if (recipients.length === 0) {
            logger.warn('sa-notifications: aucun destinataire Peda, notifications ignorées');
            return { soon: 0, late: 0 };
        }
        const userIds = recipients.map((u) => u.id);

        let soonCount = 0;
        for (const seq of soon) {
            try {
                await this.notifySoon(seq, userIds);
                await this.sequences.markSoonNotified(seq._id, now);
                soonCount += 1;
            } catch (err) {
                // On isole l'échec d'une SA : les autres doivent être traitées.
                // Non marquée → nouvelle tentative au prochain tick.
                logger.error({ err, sequenceId: seq._id }, 'sa-notifications: échec notification « en cours »');
            }
        }

        let lateCount = 0;
        for (const seq of late) {
            try {
                await this.notifyLate(seq, userIds);
                await this.sequences.markLateNotified(seq._id, now);
                lateCount += 1;
            } catch (err) {
                logger.error({ err, sequenceId: seq._id }, 'sa-notifications: échec notification « en retard »');
            }
        }
        return { soon: soonCount, late: lateCount };
    }

    /** Équipe pédagogique : rôle PEDA + RESPONSABLE / ADMIN (managers). */
    private async findPedaRecipients(): Promise<UserRowJoined[]> {
        const [byRole, byPermission] = await Promise.all([
            this.userRepository.findByRoleIds([3]), // PEDA
            this.userRepository.findByPermissionIds([2, 3]), // RESPONSABLE, ADMIN
        ]);
        const map = new Map<number, UserRowJoined>();
        for (const u of byRole) map.set(u.id, u);
        for (const u of byPermission) map.set(u.id, u);
        return [...map.values()];
    }

    private async alternantLabel(alternantId: string): Promise<{ name: string; active: boolean }> {
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) return { name: 'Un alternant', active: false };
        if (alternant.archived_at != null) return { name: 'Un alternant', active: false };
        return { name: `${alternant.first_name} ${alternant.last_name}`.trim() || 'Un alternant', active: true };
    }

    private async notifySoon(seq: AlternantSequence, userIds: number[]): Promise<void> {
        const { name, active } = await this.alternantLabel(seq.alternant_id);
        // Alternant archivé ou supprimé entre la requête et l'envoi : on ignore
        // silencieusement (la SA sera marquée comme notifiée par l'appelant).
        if (!active) return;
        const date = formatDateFr(seq.prevue_le);
        await Promise.all(
            userIds.map((userId) =>
                this.notificationService.create({
                    userId,
                    type: 'sa_soon',
                    category: 'peda',
                    level: 'info',
                    title: 'SA en cours',
                    message: `La SA n°${seq.numero} de ${name} est prévue le ${date}.`,
                    link: `/peda/alternants/${seq.alternant_id}`,
                }),
            ),
        );
    }

    private async notifyLate(seq: AlternantSequence, userIds: number[]): Promise<void> {
        const { name, active } = await this.alternantLabel(seq.alternant_id);
        if (!active) return;
        const date = formatDateFr(seq.prevue_le);
        await Promise.all(
            userIds.map((userId) =>
                this.notificationService.create({
                    userId,
                    type: 'sa_late',
                    category: 'peda',
                    level: 'warning',
                    title: 'SA en retard',
                    message: `La SA n°${seq.numero} de ${name} est en retard (prévue le ${date}).`,
                    link: `/peda/alternants/${seq.alternant_id}`,
                }),
            ),
        );
    }
}
