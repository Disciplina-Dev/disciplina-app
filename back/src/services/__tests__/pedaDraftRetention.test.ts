import { describe, it, expect, beforeEach } from 'vitest';
import pool from '../../db/mysql/connection';
import { PedaDraftHistoryRepository } from '../../repositories/mysql/PedaDraftHistoryRepository';

describe('peda_draft_history retention (RGPD Art. 5.1.e)', () => {
    beforeEach(async () => {
        await pool.query('DELETE FROM peda_draft_history');
    });

    it('anonymise le destinataire au-delà de la rétention mais garde la dedup_key', async () => {
        await pool.query(
            `INSERT INTO peda_draft_history (dedup_key, user_id, level, recipient, created_at) VALUES
             ('old', NULL, 'N1', 'eleve@test.local', NOW() - INTERVAL 400 DAY),
             ('recent', NULL, 'N1', 'eleve2@test.local', NOW())`,
        );
        const repo = new PedaDraftHistoryRepository();
        expect(await repo.anonymizeOlderThan(365)).toBe(1);

        const [rows] = await pool.query<any[]>(
            'SELECT dedup_key, recipient FROM peda_draft_history ORDER BY dedup_key',
        );
        expect(rows).toEqual([
            { dedup_key: 'old', recipient: '' },
            { dedup_key: 'recent', recipient: 'eleve2@test.local' },
        ]);
        expect(await repo.exists('old')).toBe(true);
        // Idempotent : plus rien à anonymiser.
        expect(await repo.anonymizeOlderThan(365)).toBe(0);
    });
});
