import { SaNotificationService } from '../services/SaNotificationService';
import { runForAllRegions, getRegion } from '../db/tenant';
import { logger } from '../external/logger/logger';

// Tick horaire : la granularité « jour » des échéances de SA ne nécessite pas
// de vérifier plus souvent. La dédup par SA (`soon_notified_at` /
// `late_notified_at`) garantit que chaque transition n'est notifiée qu'une
// fois, quel que soit le nombre de ticks.
const TICK_MS = 60 * 60_000;

/**
 * Planificateur des notifications « SA en cours / en retard » : à chaque tick,
 * notifie l'équipe Peda pour toute SA en attente entrée pour la première fois
 * dans la fenêtre « En cours » (moins de 14 jours) ou passée « En retard ».
 * In-process (setInterval), à l'image de `immersionEndScheduler`.
 */
export function startSaNotificationScheduler(): NodeJS.Timeout {
    const service = new SaNotificationService();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await runForAllRegions(async () => {
                const region = getRegion();
                try {
                    const { soon, late } = await service.run();
                    if (soon > 0 || late > 0)
                        logger.info({ region, soon, late }, 'sa-notifications: notifications émises');
                } catch (err) {
                    logger.error({ err, region }, 'sa-notifications: tick du scheduler en erreur');
                }
            });
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
