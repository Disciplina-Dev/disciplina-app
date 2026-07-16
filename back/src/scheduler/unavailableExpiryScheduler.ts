import { CandidateService } from '../services/CandidateService';
import { logger } from '../external/logger/logger';

// Tick horaire : la granularité « jour » de la date de disponibilité ne nécessite
// pas de vérifier plus souvent. La bascule atomique en base garantit qu'un
// candidat n'est traité (et notifié) qu'une seule fois.
const TICK_MS = 60 * 60_000;

/**
 * Planificateur de fin d'indisponibilité : à chaque tick, repasse en recherche et
 * notifie les RH pour tout candidat dont la date de disponibilité est atteinte,
 * sans attendre qu'une lecture de la fiche déclenche la bascule paresseuse.
 * In-process (setInterval), à l'image de `pedaDraftScheduler`.
 */
export function startUnavailableExpiryScheduler(): NodeJS.Timeout {
    const candidateService = new CandidateService();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const reverted = await candidateService.processExpiredUnavailable();
            if (reverted > 0) logger.info({ reverted }, 'unavailable-expiry: candidats repassés en recherche');
        } catch (err) {
            logger.error({ err }, 'unavailable-expiry: tick du scheduler en erreur');
        } finally {
            running = false;
        }
    };

    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref(); // ne bloque pas l'arrêt du process
    return timer;
}
