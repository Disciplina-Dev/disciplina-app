import { query } from '../../db/mysql/connection';
import { ExternalAccessRow } from '../../types/db-rows.types';

export class ExternalAccessRepository {
    async findBySignature(signature: string): Promise<ExternalAccessRow | null> {
        const rows = await query<ExternalAccessRow[]>(
            'SELECT * FROM external_access WHERE signature = ?',
            [signature],
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async setStatus(
        signature: string,
        status: ExternalAccessRow['status'],
    ): Promise<void> {
        await query('UPDATE external_access SET status = ? WHERE signature = ?', [
            status,
            signature,
        ]);
    }
}
