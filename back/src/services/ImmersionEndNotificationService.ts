import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { Role } from '../types/user.types';
import { Candidate } from '../types/candidate.types';
import { logger } from '../external/logger/logger';

/**
 * Émet une notification « immersion terminée » pour chaque candidat dont la date
 * de fin d'immersion est passée et qui n'a pas encore été notifié. La
 * notification est envoyée à toute l'équipe RH (RH + RESPONSABLE + ADMIN).
 *
 * La déduplication repose sur `candidate.immersion_end_notified_at` : une fois la
 * notification émise, le candidat est marqué pour ne plus être re-notifié.
 */
export class ImmersionEndNotificationService {
    private candidateRepository = new CandidateRepository();
    private userRepository = new UserRepository();
    private notificationService = new NotificationService();

    async run(now: Date = new Date()): Promise<number> {
        const candidates = await this.candidateRepository.findImmersionEndedUnnotified(now);
        if (candidates.length === 0) return 0;

        const rhUsers = (await this.userRepository.findByRoles([Role.RH, Role.RESPONSABLE, Role.ADMIN])) ?? [];
        if (rhUsers.length === 0) {
            logger.warn('immersion-end: aucun destinataire RH, notifications ignorées');
            return 0;
        }

        let notified = 0;
        for (const candidate of candidates) {
            try {
                await this.notifyOne(candidate, rhUsers.map((u) => u.id));
                await this.candidateRepository.markImmersionEndNotified(candidate._id, now);
                notified += 1;
            } catch (err) {
                // On isole l'échec d'un candidat : les autres doivent être traités.
                // Non marqué → nouvelle tentative au prochain tick.
                logger.error({ err, candidateId: candidate._id }, 'immersion-end: échec notification candidat');
            }
        }
        return notified;
    }

    private async notifyOne(candidate: Candidate, userIds: number[]): Promise<void> {
        const name = candidate.identity?.full_name ?? 'Un candidat';
        const company = candidate.immersion_company_name ?? "l'entreprise";
        await Promise.all(
            userIds.map((userId) =>
                this.notificationService.create({
                    userId,
                    type: 'immersion_ended',
                    level: 'info',
                    title: 'Immersion terminée',
                    message: `L'immersion de ${name} chez ${company} est terminée.`,
                    link: `/rh/candidats/${candidate._id}`,
                }),
            ),
        );
    }
}
