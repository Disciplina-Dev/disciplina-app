import { query } from './connection';
import { logger } from '../../external/logger';

interface ColumnSpec {
    table: string;
    column: string;
    definition: string;
}

/**
 * Columns that must exist for the current code to work. mysql-init.sql only
 * runs on a fresh volume, so live databases (local Docker volumes, production)
 * are caught up here at boot. Append new entries when the schema evolves.
 */
const REQUIRED_COLUMNS: ColumnSpec[] = [
    { table: 'companies', column: 'relance_date', definition: 'DATE DEFAULT NULL' },
    { table: 'companies', column: 'relance_type', definition: 'TINYINT DEFAULT NULL' },
    { table: 'companies', column: 'relance_template_id', definition: 'VARCHAR(64) DEFAULT NULL' },
];

export async function runMysqlMigrations(): Promise<void> {
    for (const { table, column, definition } of REQUIRED_COLUMNS) {
        const rows = await query<{ count: number }[]>(
            'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [table, column],
        );
        if (Number(rows[0]?.count) > 0) continue;

        // Identifiers come from the hardcoded list above, never from user input
        await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        logger.info(`MySQL migration: added column ${table}.${column}`);
    }
}
