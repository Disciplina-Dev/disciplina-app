import { SaNotificationService } from '../services/SaNotificationService';
import { SaAppointmentService } from '../services/SaAppointmentService';
import { SaDefaillanceService } from '../services/SaDefaillanceService';
import { AlternantIncidentService } from '../services/AlternantIncidentService';
import { runForAllRegions, getRegion } from '../db/tenant';
import { logger } from '../external/logger/logger';

// Tick horaire : la granularité « jour » des échéances de SA ne nécessite pas
// de vérifier plus souvent. La dédup par SA (`soon_notified_at` /
// `late_notified_at`) garantit que chaque transition n'est notifiée qu'une
// fois, quel que soit le nombre de ticks.
const TICK_MS = 60 * 60_000;

/**
 * Planificateur des notifications « SA en cours / en retard » (équipe Peda) et
 * des propositions de RDV au maître d'apprentissage (#961) : à chaque tick,
 * notifie l'équipe Peda pour toute SA en attente entrée pour la première fois
 * dans la fenêtre « En cours » (moins de 14 jours) ou passée « En retard », et
 * envoie une proposition de date aux mentors des SA à venir dans 2 à 3
 * semaines, escalade les entreprises défaillantes signalées par un péda
 * (courrier d'alerte à J+7, info Direction/Commercial à J+14), et rappelle en
 * interne les accidents déclarés dont la déclaration (48h) ou l'analyse des
 * causes (1 semaine) n'est toujours pas cochée faite (#970). In-process
 * (setInterval), à l'image de `immersionEndScheduler`.
 */
export function startSaNotificationScheduler(): NodeJS.Timeout {
    const service = new SaNotificationService();
    const appointmentService = new SaAppointmentService();
    const defaillanceService = new SaDefaillanceService();
    const incidentService = new AlternantIncidentService();
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
                try {
                    const { proposed } = await appointmentService.run();
                    if (proposed > 0) logger.info({ region, proposed }, 'sa-appointments: propositions envoyées');
                } catch (err) {
                    logger.error({ err, region }, 'sa-appointments: tick du scheduler en erreur');
                }
                try {
                    const { alerted, escalated } = await defaillanceService.run();
                    if (alerted > 0 || escalated > 0)
                        logger.info({ region, alerted, escalated }, 'sa-defaillance: escalade exécutée');
                } catch (err) {
                    logger.error({ err, region }, 'sa-defaillance: tick du scheduler en erreur');
                }
                try {
                    const { declarationReminders, analysisReminders } = await incidentService.run();
                    if (declarationReminders > 0 || analysisReminders > 0)
                        logger.info({ region, declarationReminders, analysisReminders }, 'incident: rappels envoyés');
                } catch (err) {
                    logger.error({ err, region }, 'incident: tick du scheduler en erreur');
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
