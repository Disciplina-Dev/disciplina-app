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
    { table: 'companies', column: 'relance_channel', definition: "ENUM('PHONE', 'MAIL') DEFAULT NULL" },
    { table: 'companies', column: 'created_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    // AB rework (2026-06-12): multi-position support, age range, free-text conditions
    { table: 'needs_analysis', column: 'positions', definition: 'JSON DEFAULT NULL' },
    { table: 'needs_analysis', column: 'age_min', definition: 'INT DEFAULT NULL' },
    { table: 'needs_analysis', column: 'age_max', definition: 'INT DEFAULT NULL' },
    { table: 'needs_analysis', column: 'conditions', definition: 'TEXT DEFAULT NULL' },
    // Booking: modèle de mail de confirmation choisi par l'hôte (copié depuis ses modèles RH).
    { table: 'booking_settings', column: 'confirmation_subject', definition: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'booking_settings', column: 'confirmation_body', definition: 'TEXT DEFAULT NULL' },
    // Booking: modèle de mail de proposition d'entretien (lien de réservation envoyé au candidat).
    { table: 'booking_settings', column: 'proposition_subject', definition: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'booking_settings', column: 'proposition_body', definition: 'TEXT DEFAULT NULL' },
    // Historique des modifications enrichi : auteur de la modif + statut avant changement.
    { table: 'company_history', column: 'modified_by', definition: 'INT DEFAULT NULL' },
    { table: 'company_history', column: 'previous_status', definition: 'VARCHAR(50) DEFAULT NULL' },
    // Todos : soft delete des todos SYSTEM pour ne pas recréer une relance supprimée par l'utilisateur.
    { table: 'todos', column: 'deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
];

/**
 * Tables that must exist for the current code to work. Same rationale as
 * REQUIRED_COLUMNS: mysql-init.sql only runs on a fresh volume.
 */
const REQUIRED_TABLES: { table: string; ddl: string }[] = [
    {
        // Journal des prises de contact (appels) d'un commercial vers une entreprise.
        // Une ligne = un appel logué ; le commentaire est obligatoire côté service.
        table: 'contact_logs',
        ddl: `CREATE TABLE IF NOT EXISTS contact_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            user_id INT NOT NULL,
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_contact_company (company_id),
            INDEX idx_contact_user (user_id)
        )`,
    },
    {
        // KPI RH agrégés par utilisateur (RH) et par bucket (année ISO / mois / semaine ISO).
        // Une ligne = un (user, year, month, week) ; les compteurs sont incrémentés au fil des actions.
        table: 'rh_kpi',
        ddl: `CREATE TABLE IF NOT EXISTS rh_kpi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            sector VARCHAR(64) NOT NULL DEFAULT '',
            year SMALLINT NOT NULL,
            month TINYINT NOT NULL,
            week TINYINT NOT NULL,
            interviews_placed INT NOT NULL DEFAULT 0,
            interviews_attended INT NOT NULL DEFAULT 0,
            interviews_noshow INT NOT NULL DEFAULT 0,
            immersions INT NOT NULL DEFAULT 0,
            contracts INT NOT NULL DEFAULT 0,
            ruptures INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_rh_kpi (user_id, sector, year, month, week),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
        )`,
    },
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
            UNIQUE KEY unique_kpi (user_id, year, month, week, site),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
        )`,
    },
    {
        table: 'companies_blacklist',
        ddl: `CREATE TABLE IF NOT EXISTS companies_blacklist (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            legal_referent VARCHAR(255) DEFAULT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            address VARCHAR(255) NOT NULL,
            sector VARCHAR(255) NOT NULL DEFAULT 'Nord-Est',
            main_activity VARCHAR(255) DEFAULT NULL,
            siret CHAR(14) UNIQUE NOT NULL,
            idcc CHAR(4) DEFAULT NULL,
            ape CHAR(5) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            conclusion VARCHAR(255) NOT NULL DEFAULT '',
            status VARCHAR(50) NOT NULL DEFAULT 'À Réfléchir',
            relance_date DATE DEFAULT NULL,
            relance_type TINYINT DEFAULT NULL,
            relance_template_id VARCHAR(64) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            all_blacklist TINYINT DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
        )`,
    },
    {
        // Session de portail entreprise (acceptation interactive des candidats).
        // Une ligne = un lien envoyé à une entreprise pour répondre aux candidats proposés d'un job.
        table: 'match_link',
        ddl: `CREATE TABLE IF NOT EXISTS match_link (
            signature CHAR(64) PRIMARY KEY,
            code CHAR(6) NOT NULL,
            identifier VARCHAR(32) NOT NULL,
            rh_email VARCHAR(255) NOT NULL,
            company_email VARCHAR(255) NOT NULL,
            job_uuid VARCHAR(64) NOT NULL,
            status ENUM('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
            attempts TINYINT NOT NULL DEFAULT 0,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
    },
    {
        // Choix de créneau d'entretien par le candidat (portail public, code d'accès simple).
        // Une ligne = un lien envoyé à un candidat proposé pour choisir un créneau parmi le pool du job.
        table: 'interview_access',
        ddl: `CREATE TABLE IF NOT EXISTS interview_access (
            signature CHAR(64) PRIMARY KEY,
            code CHAR(6) NOT NULL,
            job_uuid VARCHAR(64) NOT NULL,
            candidate_id VARCHAR(64) NOT NULL,
            rh_email VARCHAR(255) NOT NULL,
            status ENUM('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
            attempts TINYINT NOT NULL DEFAULT 0,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_interview_access_job (job_uuid),
            INDEX idx_interview_access_candidate (candidate_id)
        )`,
    },
    {
        // Public booking ("Calendly"-style) settings per RH/responsable.
        table: 'booking_settings',
        ddl: `CREATE TABLE IF NOT EXISTS booking_settings (
            user_id INT PRIMARY KEY,
            slug VARCHAR(32) NOT NULL UNIQUE,
            enabled TINYINT NOT NULL DEFAULT 1,
            duration_min INT NOT NULL DEFAULT 30,
            buffer_min INT NOT NULL DEFAULT 0,
            timezone VARCHAR(64) NOT NULL DEFAULT 'Indian/Reunion',
            min_notice_hours INT NOT NULL DEFAULT 12,
            max_days_ahead INT NOT NULL DEFAULT 30,
            -- { "1": [["09:00","12:00"],["14:00","18:00"]], ... } clé = jour ISO 1=lun..7=dim
            working_hours JSON DEFAULT NULL,
            title VARCHAR(255) NOT NULL DEFAULT 'Rendez-vous',
            location VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
        )`,
    },
    {
        // Historique des relances commerciales (canal + objet/note), une ligne par relance.
        table: 'relance_history',
        ddl: `CREATE TABLE IF NOT EXISTS relance_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            user_id INT DEFAULT NULL,
            type_relance INT DEFAULT NULL,
            channel ENUM('PHONE', 'MAIL') NOT NULL,
            subject TEXT DEFAULT NULL,
            note TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
            INDEX idx_relance_history_company (company_id)
        )`,
    },
    {
        // Lieu de rendez-vous par défaut, configurable par l'admin, pour chaque
        // secteur géographique (Nord-Est / Ouest / Sud). Pré-rempli dans la prise
        // de RDV selon le secteur du RH/responsable hôte (reste éditable).
        table: 'sector_settings',
        ddl: `CREATE TABLE IF NOT EXISTS sector_settings (
            sector VARCHAR(64) NOT NULL PRIMARY KEY,
            location VARCHAR(255) NOT NULL DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
    },
    {
        // Todo list personnelle (une ligne = un todo d'un user). source=SYSTEM pour
        // les todos créés automatiquement (AB signé, relance échue) avec source_ref
        // comme clé de déduplication ; deleted=1 = soft delete (ne pas recréer).
        table: 'todos',
        ddl: `CREATE TABLE IF NOT EXISTS todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            deadline DATE DEFAULT NULL,
            position INT NOT NULL DEFAULT 0,
            status ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
            source ENUM('MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
            source_ref VARCHAR(255) DEFAULT NULL,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_todos_user (user_id)
        )`,
    },
];

/** Lieux par défaut (modifiables ensuite par l'admin via l'interface). */
const SECTOR_SETTINGS_DEFAULTS: { sector: string; location: string }[] = [
    { sector: 'Nord-Est', location: 'Disciplina Nord-Est — Sainte-Marie' },
    { sector: 'Ouest', location: 'Disciplina Ouest — Saint-Paul' },
    { sector: 'Sud', location: 'Disciplina Sud — Saint-Pierre' },
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
        // Split DROP + ADD into two statements: TiDB rejects a combined
        // "DROP INDEX x, ADD ... x" ALTER with "Duplicate key name".
        await query('ALTER TABLE commercial_kpi DROP INDEX unique_kpi');
        await query('ALTER TABLE commercial_kpi ADD UNIQUE KEY unique_kpi (user_name, year, month, week, site)');
        logger.info('MySQL migration: added commercial_kpi.week and widened unique_kpi');
    }

    // commercial_kpi identity moved from user_name to user_id (2026-06-29): KPI
    // rows are now tied to a real user; user_name kept only as a display snapshot.
    // Rebuild unique_kpi on (user_id, …). Legacy rows with user_id NULL keep
    // surviving user deletion (MySQL treats NULLs as distinct in unique keys).
    const uniqueKpiCols = await query<{ COLUMN_NAME: string }[]>(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commercial_kpi' AND INDEX_NAME = 'unique_kpi'",
    );
    if (uniqueKpiCols.some((c) => c.COLUMN_NAME === 'user_name')) {
        // Drop rows that would collide on the new key (same user_id+période), keeping the newest.
        await query(`
            DELETE c1 FROM commercial_kpi c1
            JOIN commercial_kpi c2
              ON c1.user_id = c2.user_id AND c1.year = c2.year AND c1.month = c2.month
             AND c1.week = c2.week AND c1.site = c2.site AND c1.id < c2.id
            WHERE c1.user_id IS NOT NULL
        `);
        // Split DROP + ADD: TiDB rejects the combined form with "Duplicate key name".
        await query('ALTER TABLE commercial_kpi DROP INDEX unique_kpi');
        await query('ALTER TABLE commercial_kpi ADD UNIQUE KEY unique_kpi (user_id, year, month, week, site)');
        logger.info('MySQL migration: commercial_kpi unique_kpi rebuilt on user_id');
    }

    // rh_kpi gained a `sector` dimension (2026-06-30): add the column and widen
    // the unique key to (user_id, sector, year, month, week). Existing rows keep
    // sector = '' (= "secteur inconnu / global").
    const rhKpiSectorCol = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_kpi' AND COLUMN_NAME = 'sector'",
    );
    if (Number(rhKpiSectorCol[0]?.count) === 0) {
        await query("ALTER TABLE rh_kpi ADD COLUMN sector VARCHAR(64) NOT NULL DEFAULT '' AFTER user_id");
        logger.info('MySQL migration: added rh_kpi.sector');
    }
    // Widen unique_rh_kpi to include `sector`. The FK on user_id relies on this
    // index, so MySQL refuses a direct DROP: create the widened index first
    // (it also covers user_id for the FK), then drop the old one. Idempotent:
    // keyed on whether the current unique_rh_kpi already includes `sector`.
    const rhKpiUniqueCols = await query<{ COLUMN_NAME: string }[]>(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_kpi' AND INDEX_NAME = 'unique_rh_kpi'",
    );
    if (rhKpiUniqueCols.length > 0 && !rhKpiUniqueCols.some((c) => c.COLUMN_NAME === 'sector')) {
        // Idempotent step-by-step: a crash between the ADD and the DROP leaves
        // unique_rh_kpi_sector already present, so guard each statement on the
        // actual index state instead of re-issuing a blind ADD (which throws
        // "Duplicate key name 'unique_rh_kpi_sector'").
        const sectorIdx = await query<{ count: number }[]>(
            "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_kpi' AND INDEX_NAME = 'unique_rh_kpi_sector'",
        );
        if (Number(sectorIdx[0]?.count) === 0) {
            await query('ALTER TABLE rh_kpi ADD UNIQUE KEY unique_rh_kpi_sector (user_id, sector, year, month, week)');
        }
        await query('ALTER TABLE rh_kpi DROP INDEX unique_rh_kpi');
        logger.info('MySQL migration: widened rh_kpi unique key to include sector');
    }

    // AB rework (2026-06-12): education_level was removed from the form, the
    // column must accept NULL for new rows.
    const educationLevel = await query<{ IS_NULLABLE: string }[]>(
        "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'needs_analysis' AND COLUMN_NAME = 'education_level'",
    );
    if (educationLevel[0]?.IS_NULLABLE === 'NO') {
        await query(
            "ALTER TABLE needs_analysis MODIFY COLUMN education_level ENUM('BAC', 'BAC_PLUS_2', 'BAC_PLUS_3') DEFAULT NULL",
        );
        logger.info('MySQL migration: needs_analysis.education_level is now nullable');
    }

    // Seed des lieux de RDV par secteur. INSERT IGNORE : ne réécrit pas une valeur
    // déjà personnalisée par l'admin, crée seulement les lignes manquantes.
    for (const { sector, location } of SECTOR_SETTINGS_DEFAULTS) {
        await query('INSERT IGNORE INTO sector_settings (sector, location) VALUES (?, ?)', [sector, location]);
    }
}
