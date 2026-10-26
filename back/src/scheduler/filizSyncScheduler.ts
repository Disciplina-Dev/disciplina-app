import { FilizSyncService } from '../services/FilizSyncService';
import { AppSettingsRepository } from '../repositories/mysql/AppSettingsRepository';
import { runForAllRegions, getRegion } from '../db/tenant';
import { tenantTimezone } from '../config/tenant';
import { logger } from '../external/logger';

export const FILIZ_SYNC_LAST_RUN_KEY = 'filiz_sync_last_run';

// Tick horaire ; la sync tourne une fois par jour, à partir de 03h (heure locale du tenant).
const TICK_MS = 60 * 60_000;
const SYNC_HOUR = 3;

function nowInRegion(): { date: string; hour: number } {
    const parts = new Intl.DateTimeFormat('fr-CA', {
        timeZone: tenantTimezone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/**
 * Planificateur de la synchro Filiz → `alternants.filiz`, au plus une fois par jour et par tenant
 * (garde `filiz_sync_last_run`). In-process (setInterval), à l'image de `pedaDraftScheduler`.
 */
export function startFilizSyncScheduler(): NodeJS.Timeout {
    const service = new FilizSyncService();
    const settingsRepo = new AppSettingsRepository();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await runForAllRegions(async () => {
                const region = getRegion();
                try {
                    const { date, hour } = nowInRegion();
                    if (hour < SYNC_HOUR) return;
                    if ((await settingsRepo.get(FILIZ_SYNC_LAST_RUN_KEY)) === date) return;
                    // Marqué avant exécution : une erreur ne doit pas relancer la sync à chaque tick.
                    await settingsRepo.set(FILIZ_SYNC_LAST_RUN_KEY, date);
                    logger.info({ region, date }, 'filiz-sync: lancement de la synchro quotidienne');
                    await service.syncAll();
                } catch (err) {
                    logger.error({ err, region }, 'filiz-sync: tick du scheduler en erreur');
                }
            });
        } finally {
            running = false;
        }
    };

    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref(); // ne bloque pas l'arrêt du process
    return timer;
}
