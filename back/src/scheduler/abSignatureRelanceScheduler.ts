import { AbSignatureRelanceService } from '../services/AbSignatureRelanceService';
import { logger } from '../external/logger/logger';

// Tick horaire : la granularité « jour » du délai de 2 semaines ne nécessite pas
// de vérifier plus souvent. La dédup par AB (`last_relance_at`) garantit qu'une
// AB non signée ne reçoit sa relance unique qu'une seule fois, quel que soit le
// nombre de ticks (le champ n'est posé qu'après un envoi réussi).
const TICK_MS = 60 * 60_000; // 1H, could be modified to 24H if we want to reduce the number of ticks

/**
 * Planificateur de la relance automatique de signature des AB : à chaque tick,
 * envoie la relance « AB à signer » aux AB envoyées en signature depuis au moins
 * 2 semaines et toujours non signées. In-process (setInterval), à l'image des
 * autres schedulers.
 */
export function startAbSignatureRelanceScheduler(): NodeJS.Timeout {
    const service = new AbSignatureRelanceService();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const relanced = await service.run();
            if (relanced > 0) logger.info({ relanced }, 'ab-relance: relances de signature envoyées');
        } catch (err) {
            logger.error({ err }, 'ab-relance: tick du scheduler en erreur');
        } finally {
            running = false;
        }
    };

    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref();
    return timer;
}