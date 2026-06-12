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
    { table: 'companies', column: 'created_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
];

/**
 * Tables that must exist for the current code to work. Same rationale as
 * REQUIRED_COLUMNS: mysql-init.sql only runs on a fresh volume.
 */
const REQUIRED_TABLES: { table: string; ddl: string }[] = [
    {
        table: 'commercial_kpi',
        ddl: `CREATE TABLE IF NOT EXISTS commercial_kpi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            user_name VARCHAR(255) NOT NULL,
            year YEAR NOT NULL,
            month TINYINT NOT NULL,
            week TINYINT NOT NULL DEFAULT 0,
            site ENUM('NORD', 'OUEST', 'SUD') NOT NULL DEFAULT 'NORD',
            count_oui INT NOT NULL DEFAULT 0,
            count_oui_of INT NOT NULL DEFAULT 0,
            count_non INT NOT NULL DEFAULT 0,
            count_ne_repond_pas INT NOT NULL DEFAULT 0,
            count_a_reflechir INT NOT NULL DEFAULT 0,
            count_relance INT NOT NULL DEFAULT 0,
            total_appels INT NOT NULL DEFAULT 0,
            total_trie INT NOT NULL DEFAULT 0,
            nbre_ent_ferme INT NOT NULL DEFAULT 0,
            nbre_ent_ouvert INT NOT NULL DEFAULT 0,
            visites_terrain INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_kpi (user_name, year, month, week, site),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
        )`,
    },
];

export async function runMysqlMigrations(): Promise<void> {
    for (const { table, ddl } of REQUIRED_TABLES) {
        const rows = await query<{ count: number }[]>(
            'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            [table],
        );
        if (Number(rows[0]?.count) > 0) continue;
        await query(ddl);
        logger.info(`MySQL migration: created table ${table}`);
    }

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

    // commercial_kpi created before weekly granularity: add week column and
    // widen the unique key (week = 0 means "monthly aggregate row").
    const weekColumn = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commercial_kpi' AND COLUMN_NAME = 'week'",
    );
    if (Number(weekColumn[0]?.count) === 0) {
        await query('ALTER TABLE commercial_kpi ADD COLUMN week TINYINT NOT NULL DEFAULT 0 AFTER month');
        await query(
            'ALTER TABLE commercial_kpi DROP INDEX unique_kpi, ADD UNIQUE KEY unique_kpi (user_name, year, month, week, site)',
        );
        logger.info('MySQL migration: added commercial_kpi.week and widened unique_kpi');
    }
}
