import { PedaDraftService } from '../services/PedaDraftService';
import { PedaService, PEDA_DRAFT_LAST_RUN_KEY } from '../services/PedaService';
import { AppSettingsRepository } from '../repositories/mysql/AppSettingsRepository';
import { logger } from '../external/logger/logger';

const TIMEZONE = 'Indian/Reunion';
const TICK_MS = 60_000;

function nowInReunion(): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat('fr-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}`,
    };
}

/**
 * Planificateur du job de brouillons Peda : tick chaque minute, déclenche le
 * job quand l'heure Réunion atteint l'heure globale configurée (app_settings),
 * au plus une fois par jour (garde `peda_draft_last_run`). Relire l'heure à
 * chaque tick permet de changer la config sans redémarrer le serveur.
 */
export function startPedaDraftScheduler(): NodeJS.Timeout {
    const pedaService = new PedaService();
    const settingsRepo = new AppSettingsRepository();
    const draftService = new PedaDraftService();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const { date, time } = nowInReunion();
            const configuredHour = await pedaService.getDraftHour();
            if (time < configuredHour) return;
            const lastRun = await settingsRepo.get(PEDA_DRAFT_LAST_RUN_KEY);
            if (lastRun === date) return;
            // Marqué avant exécution : une erreur ne doit pas faire re-tourner le job chaque minute.
            await settingsRepo.set(PEDA_DRAFT_LAST_RUN_KEY, date);
            logger.info({ date, time, configuredHour }, 'peda-draft: lancement du job quotidien');
            await draftService.runForAllPedas();
        } catch (err) {
            logger.error({ err }, 'peda-draft: tick du scheduler en erreur');
        } finally {
            running = false;
        }
    };

    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref(); // ne bloque pas l'arrêt du process
    return timer;
}
