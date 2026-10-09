import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { RefreshTokenRepository } from '../repositories/mysql/RefreshTokenRepository';
import { runForAllRegions, getRegion } from '../db/tenant';
import { McpAuditStore, AUDIT_RETENTION_DAYS } from '../mcp/auditStore';
import { logger } from '../external/logger/logger';

// Tick quotidien : la granularité « jour » suffit pour de la purge de rétention.
const TICK_MS = 24 * 60 * 60_000;

// Premier passage différé plutôt qu'immédiat : la purge n'a aucune urgence au démarrage,
// et les tests composants bootent l'app une fois par fichier — quatre DELETE de plus à
// chaque boot suffisaient à épuiser le pool de connexions MySQL.
const FIRST_RUN_MS = 60_000;

// Délai de grâce après expiration, pour laisser au support le temps d'investiguer
// un lien périmé signalé par un RH avant que la ligne ne disparaisse.
const GRACE_DAYS = 7;

/**
 * Planificateur de purge des accès éphémères : supprime les liens signés et les
 * refresh tokens expirés depuis plus de GRACE_DAYS jours.
 *
 * Ces tables (external_access, refresh_tokens) stockent des liens magiques
 * associés à des emails et n'étaient jamais purgées : elles croissaient
 * indéfiniment, sans aucune valeur métier passé l'expiration.
 * Cf. database/DATA_CLASSIFICATION.md. In-process (setInterval), à l'image de
 * `unavailableExpiryScheduler`.
 */
export function startExpiredAccessScheduler(): NodeJS.Timeout {
    const externalAccessRepository = new ExternalAccessRepository();
    const refreshTokenRepository = new RefreshTokenRepository();
    const mcpAuditStore = new McpAuditStore();
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            // Séquentiel : une purge de fond ne doit pas mobiliser plusieurs connexions du
            // pool d'un coup au détriment du trafic applicatif. Vérifié par tenant.
            await runForAllRegions(async () => {
                const region = getRegion();
                try {
                    const externalAccess = await externalAccessRepository.deleteExpired(GRACE_DAYS);
                    const refreshTokens = await refreshTokenRepository.deleteExpired(GRACE_DAYS);
                    // Journal d'accès MCP : rétention 1 an (politique de confidentialité).
                    const mcpAudit = await mcpAuditStore.deleteOlderThan(AUDIT_RETENTION_DAYS);
                    const total = externalAccess + refreshTokens + mcpAudit;
                    if (total > 0) {
                        logger.info(
                            { region, externalAccess, refreshTokens, mcpAudit, total },
                            'expired-access: accès expirés purgés',
                        );
                    }
                } catch (err) {
                    logger.error({ err, region }, 'expired-access: tick du scheduler en erreur');
                }
            });
        } finally {
            running = false;
        }
    };

    const firstRun = setTimeout(() => void tick(), FIRST_RUN_MS);
    firstRun.unref();
    const timer = setInterval(() => void tick(), TICK_MS);
    timer.unref(); // ne bloque pas l'arrêt du process
    return timer;
}
