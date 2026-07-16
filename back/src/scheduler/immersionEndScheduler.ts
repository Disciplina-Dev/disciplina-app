import { ImmersionEndNotificationService } from '../services/ImmersionEndNotificationService';
import { logger } from '../external/logger/logger';

// Tick horaire : la granularité « jour » de la date de fin d'immersion ne
// nécessite pas de vérifier plus souvent. La dédup par candidat
// (`immersion_end_notified_at`) garantit qu'une immersion n'est notifiée qu'une
// fois, quel que soit le nombre de ticks.
const TICK_MS = 60 * 60_000;

/**
 * Planificateur des notifications « immersion terminée » : à chaque tick, notifie
 * l'équipe RH pour tout candidat dont l'immersion vient de se terminer et qui n'a
 * pas encore été notifié. In-process (setInterval), à l'image de
 * `pedaDraftScheduler`.
 */
export function startImmersionEndScheduler(): NodeJS.Timeout {
    const service = new ImmersionEndNotificationService();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const notified = await service.run();
            if (notified > 0) logger.info({ notified }, 'immersion-end: notifications émises');
        } catch (err) {
            logger.error({ err }, 'immersion-end: tick du scheduler en erreur');
        } finally {
            running = false;
        }
    };

    // Premier passage au démarrage, puis à intervalle régulier.
    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref(); // ne bloque pas l'arrêt du process
    return timer;
}
