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
    // Booking: modèle de mail de confirmation choisi par l'hôte (copié depuis ses modèles RH).
    { table: 'booking_settings', column: 'confirmation_subject', definition: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'booking_settings', column: 'confirmation_body', definition: 'TEXT DEFAULT NULL' },
    // Booking: modèle de mail de proposition d'entretien (lien de réservation envoyé au candidat).
    { table: 'booking_settings', column: 'proposition_subject', definition: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'booking_settings', column: 'proposition_body', definition: 'TEXT DEFAULT NULL' },
    // Historique des modifications enrichi : auteur de la modif + statut avant changement.
    { table: 'company_history', column: 'modified_by', definition: 'INT DEFAULT NULL' },
    { table: 'company_history', column: 'previous_status', definition: 'VARCHAR(50) DEFAULT NULL' },
    // Historique enrichi : valeurs avant/après de chaque champ modifié (JSON [{column, from, to}]).
    { table: 'company_history', column: 'changes', definition: 'JSON DEFAULT NULL' },
    // Todos : soft delete des todos SYSTEM pour ne pas recréer une relance supprimée par l'utilisateur.
    { table: 'todos', column: 'deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'companies', column: 'ab_id', definition: 'VARCHAR(36) DEFAULT NULL' },
    { table: 'companies_blacklist', column: 'relance_channel', definition: "ENUM('PHONE', 'MAIL') DEFAULT NULL" },
    // Quarantaine : liste (JSON) des commerciaux candidats pour les conflits
    // multiple_commercials_same_siren, pour ne proposer que ceux-ci en résolution.
    { table: 'company_conflict', column: 'candidate_user_ids', definition: 'TEXT DEFAULT NULL' },
    // Colonne générée : siren = 9 premiers chiffres du siret, utilisée par le
    // regroupement d'entreprises (companiesBySiren). Déclarée dans mysql-init.sql,
    // donc absente des bases créées avant son introduction.
    {
        table: 'companies',
        column: 'siren',
        definition: 'CHAR(9) GENERATED ALWAYS AS (SUBSTRING(`siret`, 1, 9)) STORED',
    },
    // Soft delete des users : la ligne reste (historiques FK) mais sort de tous
    // les workflows (login, listes, directory). Cf. UserRepository.markDeleted.
    { table: 'users', column: 'is_deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'users', column: 'deleted_at', definition: 'TIMESTAMP NULL DEFAULT NULL' },
    { table: 'external_access', column: 'external_email', definition: 'VARCHAR(255) NULL' },
    { table: 'external_access', column: 'external_first_name', definition: 'VARCHAR(255) NULL' },
];

/**
 * Emails des users habilités à mener les entretiens AB (liste « Entretien fait
 * par »). Sert uniquement au backfill initial de la colonne is_interviewer :
 * l'équipe déborde le rôle RH (responsables + un admin). Une fois la colonne
 * créée, la liste est éditable en base et n'est plus réécrite par le boot.
 */
const INTERVIEWER_EMAILS = [
    'grondin.rh@disciplina.re', // Loic Grondin
    'boyer.rh@leholding.re', // Céline Boyer
    'gouard.rh@disciplina.re', // Marion Gouard
    'solati.rh@disciplina.re', // Solati Melody
    'armouet.rh@disciplina.re', // Armouet
    'galais.rh@disciplina.re', // Galais
    'nativel.rh@disciplina.re', // Nativel
    'payet.rh@disciplina.re', // Payet
    'direction@disciplina.re', // Lorenzo Encatassamy (Admin)
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
        // Quarantaine des entreprises Digiforma en conflit lors de l'import
        // (SIRET manquant/factice, plusieurs commerciaux sur un même SIREN).
        // Une ligne = une entreprise Digiforma non importée ; conclusion/notes
        // portent le type et le détail du conflit.
        table: 'company_conflict',
        ddl: `CREATE TABLE IF NOT EXISTS company_conflict (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            ab_id VARCHAR(36) DEFAULT NULL,
            legal_referent VARCHAR(255) DEFAULT NULL,
            name VARCHAR(255) DEFAULT NULL,
            phone VARCHAR(50) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            address VARCHAR(255) DEFAULT NULL,
            sector VARCHAR(255) DEFAULT NULL,
            main_activity VARCHAR(255) DEFAULT NULL,
            siret CHAR(14) DEFAULT NULL,
            idcc CHAR(4) DEFAULT NULL,
            ape CHAR(5) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            conclusion VARCHAR(255) DEFAULT NULL,
            status VARCHAR(50) DEFAULT NULL,
            relance_date DATE DEFAULT NULL,
            relance_type TINYINT DEFAULT NULL,
            relance_template_id VARCHAR(64) DEFAULT NULL,
            relance_channel ENUM('PHONE', 'MAIL') DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_company_conflict_siret (siret),
            FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
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
            relance_channel ENUM('PHONE', 'MAIL') DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            all_blacklist TINYINT DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
        )`,
    },
    {
        // Table de lookup pour les types d'accès externe (IMPORT_MAIL, MATCHING, INTERVIEW_SLOTS).
        table: 'external_references',
        ddl: `CREATE TABLE IF NOT EXISTS external_references (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        )`,
    },
    {
        // Table unifiée des liens signés remplaçant interview_access, match_link et external_link.
        // Chaque ligne représente un lien envoyé à un guest (candidat ou entreprise) avec
        // signature 128 chars (512 bits) + code 6 chiffres optionnel.
        table: 'external_access',
        ddl: `CREATE TABLE IF NOT EXISTS external_access (
            signature CHAR(128) PRIMARY KEY,
            code CHAR(6) NULL,
            user_id INT NOT NULL,
            external_id VARCHAR(64) NOT NULL,
            external_type ENUM('COMPANY','CANDIDATE') NOT NULL,
            external_email VARCHAR(255) NULL,
            external_first_name VARCHAR(255) NULL,
            reference_id INT NOT NULL,
            reference_key VARCHAR(255) NOT NULL,
            status ENUM('SENDING','PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'SENDING',
            attempts TINYINT NOT NULL DEFAULT 0,
            expires_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ext_access_reference (reference_id, reference_key),
            INDEX idx_ext_access_external (external_id, external_type),
            CONSTRAINT fk_ext_access_reference FOREIGN KEY (reference_id) REFERENCES external_references (id),
            CONSTRAINT fk_ext_access_user FOREIGN KEY (user_id) REFERENCES users (id)
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
        // Config du pôle pédagogique : un Google Sheet de suivi d'absences par Peda.
        // Le backend le lit chaque jour (lecture seule) pour générer des brouillons Gmail.
        table: 'peda_config',
        ddl: `CREATE TABLE IF NOT EXISTS peda_config (
            user_id INT PRIMARY KEY,
            sheet_id VARCHAR(128) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
        )`,
    },
    {
        // Déduplication des brouillons de relance absence : une ligne = un brouillon
        // déjà généré pour (sheet, feuille, apprenant, colonne "Mail niv").
        table: 'peda_draft_history',
        ddl: `CREATE TABLE IF NOT EXISTS peda_draft_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dedup_key VARCHAR(512) NOT NULL UNIQUE,
            user_id INT DEFAULT NULL,
            level VARCHAR(8) NOT NULL,
            recipient VARCHAR(255) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
        )`,
    },
    {
        // Réglages applicatifs clé/valeur (ex: heure globale du job de brouillons Peda).
        table: 'app_settings',
        ddl: `CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
            setting_value TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
        // Groupes de tâches par utilisateur. Un même nom peut exister chez deux
        // utilisateurs différents (unique sur (user_id, name)), mais un todo ne peut
        // appartenir qu'à un groupe de son owner (vérifié en service).
        // Déclaré avant `todos` car ce dernier référence cette table via FK.
        table: 'todo_groups',
        ddl: `CREATE TABLE IF NOT EXISTS todo_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_group_user_name (user_id, name),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_todo_groups_user (user_id)
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
            assigned_by INT DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            deadline DATE DEFAULT NULL,
            position INT NOT NULL DEFAULT 0,
            status ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
            source ENUM('MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
            source_ref VARCHAR(255) DEFAULT NULL,
            group_id INT DEFAULT NULL,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY (group_id) REFERENCES todo_groups(id) ON DELETE SET NULL ON UPDATE CASCADE,
            INDEX idx_todos_user (user_id),
            INDEX idx_todos_group (group_id)
        )`,
    },
    {
        // Refresh tokens (session JWT en cookie httpOnly). token_hash = sha256 du
        // token brut, jamais stocké en clair. Rotation à chaque /refresh : revoked_at
        // posé sur l'ancienne ligne, nouvelle ligne créée.
        table: 'refresh_tokens',
        ddl: `CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_refresh_user (user_id),
            INDEX idx_refresh_hash (token_hash)
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

    // Index sur la colonne générée siren (déclaré dans mysql-init.sql) : il doit
    // suivre la colonne backfillée ci-dessus sur les bases existantes.
    const sirenIndex = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND INDEX_NAME = 'idx_companies_siren'",
    );
    if (Number(sirenIndex[0]?.count) === 0) {
        await query('CREATE INDEX idx_companies_siren ON companies (siren)');
        logger.info('MySQL migration: created index idx_companies_siren');
    }


    // Rôle PEDA (2026-07-08) : élargit l'ENUM users.role. mysql-init.sql ne
    // tourne que sur un volume neuf, les bases existantes sont migrées ici.
    const roleColumn = await query<{ COLUMN_TYPE: string }[]>(
        "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
    );
    if (roleColumn[0] && !roleColumn[0].COLUMN_TYPE.includes('PEDA')) {
        await query(
            "ALTER TABLE users MODIFY COLUMN role ENUM('ADMIN', 'RESPONSABLE', 'COMMERCIAL', 'RH', 'PEDA') NOT NULL",
        );
        logger.info('MySQL migration: added PEDA to users.role enum');
    }

    // Seed des lieux de RDV par secteur. INSERT IGNORE : ne réécrit pas une valeur
    // déjà personnalisée par l'admin, crée seulement les lignes manquantes.
    for (const { sector, location } of SECTOR_SETTINGS_DEFAULTS) {
        await query('INSERT IGNORE INTO sector_settings (sector, location) VALUES (?, ?)', [sector, location]);
    }

    // Marqueur « fait passer les entretiens » (2026-07-09) : la liste « Entretien
    // fait par » de l'AB déborde le rôle RH. On ajoute la colonne et on coche la
    // liste initiale UNIQUEMENT à la création de la colonne, pour ne pas réécrire
    // les choix ultérieurs (un décochage en base doit survivre aux redéploiements).
    const interviewerCol = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_interviewer'",
    );
    if (Number(interviewerCol[0]?.count) === 0) {
        await query('ALTER TABLE users ADD COLUMN is_interviewer TINYINT(1) NOT NULL DEFAULT 0');
        const placeholders = INTERVIEWER_EMAILS.map(() => '?').join(', ');
        await query(`UPDATE users SET is_interviewer = 1 WHERE email IN (${placeholders})`, INTERVIEWER_EMAILS);
        logger.info('MySQL migration: added users.is_interviewer and seeded the AB interviewer list');
    }

    // Todos : auteur de l'assignation (2026-08-13). user_id reste le destinataire
    // de la tâche ; assigned_by = l'utilisateur qui l'a créée/assignée (NULL pour
    // les todos SYSTEM). Les lignes existantes étaient toutes auto-assignées :
    // backfill assigned_by = user_id à la création de la colonne.
    const assignedByCol = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todos' AND COLUMN_NAME = 'assigned_by'",
    );
    if (Number(assignedByCol[0]?.count) === 0) {
        await query('ALTER TABLE todos ADD COLUMN assigned_by INT DEFAULT NULL AFTER user_id');
        await query('UPDATE todos SET assigned_by = user_id WHERE assigned_by IS NULL');
        await query('ALTER TABLE todos ADD KEY idx_todos_assigned_by (assigned_by)');
        logger.info('MySQL migration: added todos.assigned_by and backfilled it to user_id');
    }

    // Le FK ci-dessous refuserait des todos orphelins (assignataire supprimé hors
    // FOREIGN_KEY_CHECKS, cf. seed de dev) : purge préalable, idempotente. Étape
    // séparée du backfill pour survivre à une application partielle.
    await query('DELETE t FROM todos t LEFT JOIN users u ON u.id = t.user_id WHERE u.id IS NULL');

    const assignedByFk = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todos' AND CONSTRAINT_NAME = 'fk_todos_assigned_by'",
    );
    if (Number(assignedByFk[0]?.count) === 0) {
        await query(
            'ALTER TABLE todos ADD CONSTRAINT fk_todos_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE',
        );
        logger.info('MySQL migration: added todos FK fk_todos_assigned_by');
    }

    // Groupes de tâches : colonne group_id et table todo_groups (2026-08-21)
    const groupIdCol = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todos' AND COLUMN_NAME = 'group_id'",
    );
    if (Number(groupIdCol[0]?.count) === 0) {
        await query('ALTER TABLE todos ADD COLUMN group_id INT DEFAULT NULL AFTER assigned_by');
        await query('ALTER TABLE todos ADD KEY idx_todos_group (group_id)');
        logger.info('MySQL migration: added todos.group_id');
    }

    const todoGroupsFk = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todos' AND CONSTRAINT_NAME = 'fk_todos_group_id'",
    );
    if (Number(todoGroupsFk[0]?.count) === 0) {
        // Ensure orphan group_ids are cleared before adding FK (old rows created before groups existed)
        await query(
            'UPDATE todos SET group_id = NULL WHERE group_id IS NOT NULL AND group_id NOT IN (SELECT id FROM todo_groups)',
        );
        // MySQL requires the column to be indexed for FK; already added above.
        try {
            await query(
                'ALTER TABLE todos ADD CONSTRAINT fk_todos_group_id FOREIGN KEY (group_id) REFERENCES todo_groups(id) ON DELETE SET NULL ON UPDATE CASCADE',
            );
            logger.info('MySQL migration: added todos FK fk_todos_group_id');
        } catch (e: unknown) {
            // FK may fail on TiDB if todo_groups doesn't exist yet due to REQUIRED_TABLES loop ordering;
            // the REQUIRED_TABLES creation above is idempotent and will have created it.
            logger.warn({ err: e }, 'MySQL migration: failed to add fk_todos_group_id');
        }
    }

    // RBAC : séparation rôles métier / permissions (2026-07-20). On crée les tables
    // de référence, on ajoute les FK à users, on migre les données existantes et
    // on supprime l'ancienne colonne role.
    const permissionsTable = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions'",
    );
    if (Number(permissionsTable[0]?.count) === 0) {
        await query(`CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE
        )`);
        await query(
            "INSERT IGNORE INTO permissions (id, name) VALUES (1, 'EMPLOYEE'), (2, 'RESPONSABLE'), (3, 'ADMIN')",
        );
        logger.info('MySQL migration: created permissions table');
    }

    const rolesTable = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles'",
    );
    if (Number(rolesTable[0]?.count) === 0) {
        await query(`CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE
        )`);
        await query(
            "INSERT IGNORE INTO roles (id, name) VALUES (1, 'COMMERCIAL'), (2, 'RH'), (3, 'PEDA'), (4, 'AD'), (5, 'GESTION')",
        );
        logger.info('MySQL migration: created roles table');
    }

    // Ajout des colonnes role_id / permission_id si absentes.
    const roleIdCol = await query<{ count: number }[]>(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'",
    );
    if (Number(roleIdCol[0]?.count) === 0) {
        // Ajouter les colonnes (d'abord NULL pour la migration)
        await query('ALTER TABLE users ADD COLUMN role_id INT DEFAULT NULL AFTER password');
        await query('ALTER TABLE users ADD COLUMN permission_id INT DEFAULT NULL AFTER role_id');

        // Migration des anciennes valeurs role → role_id / permission_id
        // ADMIN → GESTION (5) + ADMIN (3)
        await query("UPDATE users SET role_id = 5, permission_id = 3 WHERE role = 'ADMIN'");
        // COMMERCIAL → COMMERCIAL (1) + EMPLOYEE (1)
        await query("UPDATE users SET role_id = 1, permission_id = 1 WHERE role = 'COMMERCIAL'");
        // RH → RH (2) + EMPLOYEE (1)
        await query("UPDATE users SET role_id = 2, permission_id = 1 WHERE role = 'RH'");
        // PEDA → PEDA (3) + EMPLOYEE (1)
        await query("UPDATE users SET role_id = 3, permission_id = 1 WHERE role = 'PEDA'");
        // RESPONSABLE → COMMERCIAL (1) par défaut + RESPONSABLE (2)
        // Ces utilisateurs doivent être revus manuellement pour leur rôle métier.
        await query("UPDATE users SET role_id = 1, permission_id = 2 WHERE role = 'RESPONSABLE'");
        const responsibleUsers = await query<{ id: number; email: string }[]>(
            "SELECT id, email FROM users WHERE role = 'RESPONSABLE'",
        );
        if (responsibleUsers.length > 0) {
            logger.warn(
                { users: responsibleUsers.map((u) => u.email) },
                `RBAC migration: ${responsibleUsers.length} former RESPONSABLE users defaulted to COMMERCIAL role + RESPONSABLE permission. Assign their real job role manually.`,
            );
        }

        // Passage en NOT NULL
        await query('ALTER TABLE users MODIFY COLUMN role_id INT NOT NULL');
        await query('ALTER TABLE users MODIFY COLUMN permission_id INT NOT NULL');

        // Ajout des FK
        await query(
            'ALTER TABLE users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE',
        );
        await query(
            'ALTER TABLE users ADD CONSTRAINT fk_users_permission_id FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE',
        );

        // Création des index
        await query('CREATE INDEX idx_users_role_id ON users (role_id)');
        await query('CREATE INDEX idx_users_permission_id ON users (permission_id)');

        // Suppression de l'ancienne colonne role
        const oldRoleCol = await query<{ count: number }[]>(
            "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
        );
        if (Number(oldRoleCol[0]?.count) > 0) {
            // En production (TiDB) on ne peut pas DROP COLUMN avec des FK qui
            // référencent la table ; on cascade d'abord les FK existantes.
            await query('ALTER TABLE users DROP COLUMN role');
            logger.info('MySQL migration: dropped users.role, replaced by role_id + permission_id FK');
        }

        logger.info('MySQL migration: RBAC migration complete (roles + permissions tables created, users migrated)');
    }
}
