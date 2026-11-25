import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessLogService } from '../AccessLogService';
import { AccessLogRepository } from '../../repositories/mysql/AccessLogRepository';
import { query } from '../../db/mysql/connection';
import { truncateMysql } from '../../../test/helpers/db';

// GDPR_INF_06.5 : journal des lectures / exports candidat.
describe('AccessLogService', () => {
    const service = new AccessLogService();

    beforeEach(async () => {
        await truncateMysql();
    });

    it('records an event and reads it back, newest first', async () => {
        await service.record({ candidateId: 'cand-1', actorId: null, actorType: 'EXTERNAL', action: 'CV_READ' });
        await service.record({ candidateId: 'cand-1', actorId: null, actorType: 'STAFF', action: 'SSN_UNMASK' });
        await service.record({ candidateId: 'cand-2', actorId: null, actorType: 'STAFF', action: 'VIEW' });

        const entries = await service.findByCandidate('cand-1');

        expect(entries.map((e) => e.action)).toEqual(['SSN_UNMASK', 'CV_READ']);
        expect(entries[0]).toMatchObject({ candidateId: 'cand-1', actorType: 'STAFF', resultCount: 1 });
        expect(entries[0].createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    });

    it('stores a bulk list with a null candidate and its size', async () => {
        await service.record({ candidateId: null, actorId: null, actorType: 'STAFF', action: 'LIST', resultCount: 42 });

        const rows = await query<Array<{ candidate_id: string | null; result_count: number }>>(
            "SELECT candidate_id, result_count FROM candidate_access_log WHERE action = 'LIST'",
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].candidate_id).toBeNull();
        expect(Number(rows[0].result_count)).toBe(42);
    });

    it('does not throw when the write fails', async () => {
        const spy = vi.spyOn(AccessLogRepository.prototype, 'insert').mockRejectedValueOnce(new Error('db down'));

        await expect(
            service.record({ candidateId: 'cand-1', actorId: null, actorType: 'STAFF', action: 'VIEW' }),
        ).resolves.toBeUndefined();

        spy.mockRestore();
    });

    it('purges only rows older than the retention window', async () => {
        await service.record({ candidateId: 'old', actorId: null, actorType: 'STAFF', action: 'VIEW' });
        await service.record({ candidateId: 'recent', actorId: null, actorType: 'STAFF', action: 'VIEW' });
        await query("UPDATE candidate_access_log SET created_at = NOW() - INTERVAL 400 DAY WHERE candidate_id = 'old'");

        const purged = await service.purgeExpired();

        expect(purged).toBe(1);
        expect(await service.findByCandidate('old')).toHaveLength(0);
        expect(await service.findByCandidate('recent')).toHaveLength(1);
    });
});
