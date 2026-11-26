import { logger } from '../external/logger';
import { AccessLogRepository } from '../repositories/mysql/AccessLogRepository';
import { AccessEventInput, AccessLogEntry } from '../types/accessLog.types';

export const ACCESS_LOG_RETENTION_DAYS = 365;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/**
 * Journal des lectures / exports de données candidat (GDPR_INF_06.5).
 * `record` n'échoue jamais : une panne du journal ne doit pas bloquer la
 * lecture métier (même politique que `McpAuditStore.record`), elle est loguée
 * (UUID seul, sans donnée candidat).
 */
export class AccessLogService {
    private repository = new AccessLogRepository();

    async record(event: AccessEventInput): Promise<void> {
        try {
            await this.repository.insert(event);
        } catch (error) {
            logger.error(
                { err: error, candidateId: event.candidateId, action: event.action },
                'Candidate access log write failed',
            );
        }
    }

    async findByCandidate(candidateId: string, limit = DEFAULT_LIMIT): Promise<AccessLogEntry[]> {
        const safe = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
        return this.repository.findByCandidate(candidateId, safe);
    }

    async purgeExpired(): Promise<number> {
        return this.repository.deleteOlderThan(ACCESS_LOG_RETENTION_DAYS);
    }
}
