SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS disciplina;
USE disciplina;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(64) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO `permissions` (`id`, `name`) VALUES
  (1, 'EMPLOYEE'),
  (2, 'RESPONSABLE'),
  (3, 'ADMIN'),
  (4, 'GUEST');

CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO `roles` (`id`, `name`) VALUES
  (1, 'COMMERCIAL'),
  (2, 'RH'),
  (3, 'PEDA'),
  (4, 'AD'),
  (5, 'GESTION'),
  (6, 'EXTERNAL_GUEST');

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `sectors` json DEFAULT NULL,
  `oauth_token` text DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `is_interviewer` tinyint(1) NOT NULL DEFAULT '0',
  -- Soft delete : un user « supprimé » garde sa ligne pour l'historique
  -- (contact_logs, candidate_history, etc.) mais est exclu de tous les workflows.
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_role_id` (`role_id`),
  KEY `idx_users_permission_id` (`permission_id`),
  CONSTRAINT `fk_users_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_users_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Compte administrateur de bootstrap : seed dev-only, cf. database/mysql/mysql-seed-dev.sql
-- (monté uniquement par le compose de base). Jamais initialisé en production.

CREATE TABLE IF NOT EXISTS `booking_settings` (
  `user_id` int NOT NULL,
  `slug` varchar(32) NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1',
  `duration_min` int NOT NULL DEFAULT '30',
  `buffer_min` int NOT NULL DEFAULT '0',
  `timezone` varchar(64) NOT NULL DEFAULT 'Indian/Reunion',
  `min_notice_hours` int NOT NULL DEFAULT '12',
  `max_days_ahead` int NOT NULL DEFAULT '30',
  `working_hours` json DEFAULT NULL,
  `title` varchar(255) NOT NULL DEFAULT 'Rendez-vous',
  `location` varchar(255) DEFAULT NULL,
  `confirmation_subject` varchar(255) DEFAULT NULL,
  `confirmation_body` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `proposition_subject` varchar(255) DEFAULT NULL,
  `proposition_body` text DEFAULT NULL,
  PRIMARY KEY (`user_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `slug` (`slug`),
  CONSTRAINT `fk_booking_settings_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- Référentiel hiérarchique des secteurs : région > secteur > commune (adjacency
-- list, parcours via WITH RECURSIVE). Seed en fin de fichier (base fraîche) ; le
-- backend (back/src/db/mysql/sectorsMigration.ts) complète les bases existantes
-- et verrouille la parité par test. `code` n'est unique que par niveau (la commune
-- ANNECY et le secteur ANNECY coexistent). `location` reprend sector_settings.
CREATE TABLE IF NOT EXISTS `sectors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL,
  `label` varchar(255) NOT NULL,
  `level` enum('region','sector','commune') NOT NULL,
  `parent_id` int DEFAULT NULL,
  `location` varchar(255) NOT NULL DEFAULT '',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_sectors_level_code` (`level`, `code`),
  KEY `idx_sectors_parent_id` (`parent_id`),
  CONSTRAINT `fk_sectors_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `sectors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Secteurs d'un utilisateur (remplace à terme users.sectors json).
CREATE TABLE IF NOT EXISTS `user_sectors` (
  `user_id` int NOT NULL,
  `sector_id` int NOT NULL,
  PRIMARY KEY (`user_id`, `sector_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user_sectors_sector_id` (`sector_id`),
  CONSTRAINT `fk_user_sectors_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_sectors_sector_id` FOREIGN KEY (`sector_id`) REFERENCES `sectors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `ab_id` varchar(36) DEFAULT NULL,
  `legal_referent` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `sector_id` int DEFAULT NULL,
  `sector` varchar(255) NOT NULL DEFAULT 'Nord-Est',
  `main_activity` varchar(255) DEFAULT NULL,
  `siret` char(14) NOT NULL,
  `siren` char(9) GENERATED ALWAYS AS (SUBSTRING(`siret`, 1, 9)) STORED,
  `idcc` char(4) DEFAULT NULL,
  `ape` char(5) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `conclusion` varchar(255) NOT NULL DEFAULT '',
  `status` varchar(50) NOT NULL DEFAULT 'À Réfléchir',
  `relance_date` date DEFAULT NULL,
  `relance_type` tinyint DEFAULT NULL,
  `relance_template_id` varchar(64) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `relance_channel` enum('PHONE','MAIL') DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `siret` (`siret`),
  KEY `idx_companies_siren` (`siren`),
  KEY `idx_companies_user_id` (`user_id`),
  CONSTRAINT `fk_companies_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  KEY `idx_companies_sector_id` (`sector_id`),
  CONSTRAINT `fk_companies_sector_id` FOREIGN KEY (`sector_id`) REFERENCES `sectors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `company_conflict` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `ab_id` varchar(36) DEFAULT NULL,
  `legal_referent` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `sector_id` int DEFAULT NULL,
  `sector` varchar(255) DEFAULT NULL,
  `main_activity` varchar(255) DEFAULT NULL,
  `siret` char(14) DEFAULT NULL,
  `idcc` char(4) DEFAULT NULL,
  `ape` char(5) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `conclusion` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `relance_date` date DEFAULT NULL,
  `relance_type` tinyint DEFAULT NULL,
  `relance_template_id` varchar(64) DEFAULT NULL,
  `relance_channel` enum('PHONE','MAIL') DEFAULT NULL,
  `candidate_user_ids` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_company_conflict_siret` (`siret`),
  CONSTRAINT `fk_company_conflict_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  KEY `idx_company_conflict_sector_id` (`sector_id`),
  CONSTRAINT `fk_company_conflict_sector_id` FOREIGN KEY (`sector_id`) REFERENCES `sectors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `companies_blacklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `legal_referent` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `sector_id` int DEFAULT NULL,
  `sector` varchar(255) NOT NULL DEFAULT 'Nord-Est',
  `main_activity` varchar(255) DEFAULT NULL,
  `siret` char(14) NOT NULL,
  `idcc` char(4) DEFAULT NULL,
  `ape` char(5) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `conclusion` varchar(255) NOT NULL DEFAULT '',
  `status` varchar(50) NOT NULL DEFAULT 'À Réfléchir',
  `relance_date` date DEFAULT NULL,
  `relance_type` tinyint DEFAULT NULL,
  `relance_template_id` varchar(64) DEFAULT NULL,
  `relance_channel` enum('PHONE','MAIL') DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `all_blacklist` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `siret` (`siret`),
  KEY `idx_companies_blacklist_user_id` (`user_id`),
  CONSTRAINT `fk_companies_blacklist_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  KEY `idx_companies_blacklist_sector_id` (`sector_id`),
  CONSTRAINT `fk_companies_blacklist_sector_id` FOREIGN KEY (`sector_id`) REFERENCES `sectors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `company_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_column` text NOT NULL,
  `status` varchar(50) NOT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `modified_by` int DEFAULT NULL,
  `changes` json DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_company_history_company_id` (`company_id`),
  CONSTRAINT `fk_company_history_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `contact_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_contact_company` (`company_id`),
  KEY `idx_contact_user` (`user_id`),
  CONSTRAINT `fk_contact_logs_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_contact_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `filiz` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `external_references` (
  `id`   int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO `external_references` (`id`, `name`) VALUES
  (1, 'IMPORT_CV'),
  (2, 'MATCHING'),
  (3, 'INTERVIEW_SLOTS');

CREATE TABLE IF NOT EXISTS `external_access` (
  `signature`      varchar(191) NOT NULL,
  `code`           char(6)      NULL,
  `user_id`        int          NOT NULL,
  `external_id`    varchar(64)  NOT NULL,
  `external_type`  enum('COMPANY','CANDIDATE') NOT NULL,
  `external_email` varchar(255) NULL,
  `external_first_name` varchar(255) NULL,
  `token`          varchar(512) NULL,
  `reference_id`   int          NOT NULL,
  `reference_key`  varchar(255) NOT NULL,
  `status`         enum('SENDING','PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'SENDING',
  `attempts`       tinyint      NOT NULL DEFAULT '0',
  `expires_at`     timestamp    NULL DEFAULT NULL,
  `created_at`     timestamp    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     timestamp    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`signature`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_ext_access_reference` (`reference_id`, `reference_key`),
  KEY `idx_ext_access_external` (`external_id`, `external_type`),
  CONSTRAINT `fk_ext_access_reference` FOREIGN KEY (`reference_id`) REFERENCES `external_references` (`id`),
  CONSTRAINT `fk_ext_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- La table `needs_analysis` a été retirée le 2026-07-17 : l'entité vit désormais dans
-- MongoDB (collection `needs_analysis`, cf. database/mongodb/mongo-schema.md). Aucun code
-- du backend ne la lisait, et elle était vide. Voir docs/AUDIT.md §6.3.

CREATE TABLE IF NOT EXISTS `peda_config` (
  `user_id` int NOT NULL,
  `sheet_id` varchar(128) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`) /*T![clustered_index] CLUSTERED */,
  CONSTRAINT `fk_peda_config_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `peda_draft_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dedup_key` varchar(512) NOT NULL,
  `user_id` int DEFAULT NULL,
  `level` varchar(8) NOT NULL,
  `recipient` varchar(255) NOT NULL DEFAULT '',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `dedup_key` (`dedup_key`),
  KEY `idx_peda_draft_history_user_id` (`user_id`),
  CONSTRAINT `fk_peda_draft_history_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_refresh_user` (`user_id`),
  KEY `idx_refresh_hash` (`token_hash`),
  CONSTRAINT `fk_refresh_tokens_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Refresh tokens des sessions OAuth MCP (claude.ai web) : haché sha256, jamais
-- stocké en clair, rotation à chaque échange. Miroir de `refresh_tokens` mais
-- adossé à un client OAuth (mcp_oauth_clients) plutôt qu'à un utilisateur.
-- user_id : identité de l'utilisateur CRM qui a autorisé ce token (lié à la
--   table users de la région indiquée).
-- region : tenant cible (reunion | annemasse), utilisé au refresh pour
--   réémettre l'access token avec le bon contexte multi-tenant.
CREATE TABLE IF NOT EXISTS `mcp_oauth_refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(128) NOT NULL,
  `user_id` int DEFAULT NULL,
  `region` varchar(16) NOT NULL DEFAULT 'reunion',
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_mcp_refresh_client` (`client_id`),
  KEY `idx_mcp_refresh_hash` (`token_hash`),
  KEY `idx_mcp_refresh_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Clients OAuth enregistrés par claude.ai via Dynamic Client Registration (DCR),
-- pour l'accès MCP en lecture seule au CRM. user_id / region : dernier
-- utilisateur ayant autorisé ce client (mis à jour à chaque consentement).
CREATE TABLE IF NOT EXISTS `mcp_oauth_clients` (
  `client_id` varchar(128) NOT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `client_uri` varchar(512) DEFAULT NULL,
  `logo_uri` varchar(512) DEFAULT NULL,
  `redirect_uris` json NOT NULL,
  `auth_method` varchar(32) NOT NULL DEFAULT 'none',
  `scope` varchar(255) DEFAULT NULL,
  `client_secret` varchar(128) DEFAULT NULL,
  `client_id_issued_at` bigint DEFAULT NULL,
  `client_secret_expires_at` bigint DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `region` varchar(16) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`client_id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Journal d'accès MCP (RGPD, MCP_RGPD_AUDIT.md M4) : qui a consulté quel outil / quelle
-- fiche, sans résultat ni argument en clair. user_id = 0 pour la clé MCP statique.
-- Purgé à 365 jours par expiredAccessScheduler.
CREATE TABLE IF NOT EXISTS `mcp_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `client_id` varchar(128) DEFAULT NULL,
  `tool` varchar(64) NOT NULL,
  `subject_ref` varchar(80) DEFAULT NULL,
  `args_hash` varchar(32) NOT NULL,
  `result_count` int NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_mcp_audit_user_date` (`user_id`, `created_at`),
  KEY `idx_mcp_audit_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `relance_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `type_relance` int DEFAULT NULL,
  `channel` enum('PHONE','MAIL') NOT NULL,
  `subject` text DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_relance_history_company` (`company_id`),
  KEY `idx_relance_history_user_id` (`user_id`),
  CONSTRAINT `fk_relance_history_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_relance_history_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


CREATE TABLE IF NOT EXISTS `sector_settings` (
  `sector` varchar(64) NOT NULL,
  `location` varchar(255) NOT NULL DEFAULT '',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sector`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `todo_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_group_user_name` (`user_id`, `name`),
  KEY `idx_todo_groups_user` (`user_id`),
  CONSTRAINT `fk_todo_groups_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `todos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `group_id` int DEFAULT NULL,
  `title` varchar(500) NOT NULL,
  `description` text DEFAULT NULL,
  `deadline` date DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `status` enum('TODO','IN_PROGRESS','DONE') NOT NULL DEFAULT 'TODO',
  `source` enum('MANUAL','SYSTEM') NOT NULL DEFAULT 'MANUAL',
  `source_ref` varchar(255) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user_deadline` (`user_id`,`deadline`),
  KEY `idx_user_position` (`user_id`,`position`),
  KEY `idx_todos_assigned_by` (`assigned_by`),
  KEY `idx_todos_group` (`group_id`),
  CONSTRAINT `fk_todos_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_todos_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_todos_group_id` FOREIGN KEY (`group_id`) REFERENCES `todo_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- ──────────────────────────────────────────────────────────────────────────────
-- BASE SECONDAIRE : disciplina_annemasse (multi-tenant — site Annemasse).
-- Mêmes tables que `disciplina` (external_access et non plus les tables
-- dépréciées, supprimées après la migration de 2026-08).
--
-- Stratégie de clonage : `CREATE TABLE ... LIKE` copie colonnes, clés,
-- index et colonnes générées, mais PAS les contraintes de clés étrangères —
-- on les recrée donc explicitement ci-dessous, puis on rejoue les données de
-- référence (permissions, roles, external_references, sector_settings).
--
-- ATTENTION : ce bloc n'est joué que sur un volume vierge (initdb). Sur une
-- instance existante, la base a été créée par la release 1.3.0.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS disciplina_annemasse;

CREATE TABLE disciplina_annemasse.app_settings LIKE disciplina.app_settings;
CREATE TABLE disciplina_annemasse.permissions LIKE disciplina.permissions;
CREATE TABLE disciplina_annemasse.roles LIKE disciplina.roles;
CREATE TABLE disciplina_annemasse.users LIKE disciplina.users;
CREATE TABLE disciplina_annemasse.booking_settings LIKE disciplina.booking_settings;
CREATE TABLE disciplina_annemasse.companies LIKE disciplina.companies;
CREATE TABLE disciplina_annemasse.company_conflict LIKE disciplina.company_conflict;
CREATE TABLE disciplina_annemasse.companies_blacklist LIKE disciplina.companies_blacklist;
CREATE TABLE disciplina_annemasse.company_history LIKE disciplina.company_history;
CREATE TABLE disciplina_annemasse.contact_logs LIKE disciplina.contact_logs;
CREATE TABLE disciplina_annemasse.filiz LIKE disciplina.filiz;
CREATE TABLE disciplina_annemasse.external_references LIKE disciplina.external_references;
CREATE TABLE disciplina_annemasse.external_access LIKE disciplina.external_access;
CREATE TABLE disciplina_annemasse.peda_config LIKE disciplina.peda_config;
CREATE TABLE disciplina_annemasse.peda_draft_history LIKE disciplina.peda_draft_history;
CREATE TABLE disciplina_annemasse.refresh_tokens LIKE disciplina.refresh_tokens;
CREATE TABLE disciplina_annemasse.relance_history LIKE disciplina.relance_history;
CREATE TABLE disciplina_annemasse.sector_settings LIKE disciplina.sector_settings;
CREATE TABLE disciplina_annemasse.sectors LIKE disciplina.sectors;
CREATE TABLE disciplina_annemasse.user_sectors LIKE disciplina.user_sectors;
CREATE TABLE disciplina_annemasse.todo_groups LIKE disciplina.todo_groups;
CREATE TABLE disciplina_annemasse.todos LIKE disciplina.todos;

-- Contraintes de clés étrangères (non copiées par LIKE) — mêmes noms et
-- mêmes règles que dans `disciplina`.
ALTER TABLE disciplina_annemasse.users
  ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES disciplina_annemasse.roles (id) ON UPDATE CASCADE,
  ADD CONSTRAINT fk_users_permission_id FOREIGN KEY (permission_id) REFERENCES disciplina_annemasse.permissions (id) ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.booking_settings
  ADD CONSTRAINT fk_booking_settings_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.companies
  ADD CONSTRAINT fk_companies_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.company_conflict
  ADD CONSTRAINT fk_company_conflict_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.companies_blacklist
  ADD CONSTRAINT fk_companies_blacklist_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.company_history
  ADD CONSTRAINT fk_company_history_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.contact_logs
  ADD CONSTRAINT fk_contact_logs_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_contact_logs_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.external_access
  ADD CONSTRAINT fk_ext_access_reference FOREIGN KEY (reference_id) REFERENCES disciplina_annemasse.external_references (id),
  ADD CONSTRAINT fk_ext_access_user FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id);

ALTER TABLE disciplina_annemasse.peda_config
  ADD CONSTRAINT fk_peda_config_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.peda_draft_history
  ADD CONSTRAINT fk_peda_draft_history_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.refresh_tokens
  ADD CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.relance_history
  ADD CONSTRAINT fk_relance_history_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_relance_history_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.todo_groups
  ADD CONSTRAINT fk_todo_groups_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE;

ALTER TABLE disciplina_annemasse.todos
  ADD CONSTRAINT fk_todos_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_todos_assigned_by FOREIGN KEY (assigned_by) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_todos_group_id FOREIGN KEY (group_id) REFERENCES disciplina_annemasse.todo_groups (id) ON DELETE SET NULL;

-- Référentiel des secteurs : FK recréées (non copiées par LIKE). Seed au boot backend.
ALTER TABLE disciplina_annemasse.sectors
  ADD CONSTRAINT fk_sectors_parent_id FOREIGN KEY (parent_id) REFERENCES disciplina_annemasse.sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.user_sectors
  ADD CONSTRAINT fk_user_sectors_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_user_sectors_sector_id FOREIGN KEY (sector_id) REFERENCES disciplina_annemasse.sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.companies
  ADD CONSTRAINT fk_companies_sector_id FOREIGN KEY (sector_id) REFERENCES disciplina_annemasse.sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.company_conflict
  ADD CONSTRAINT fk_company_conflict_sector_id FOREIGN KEY (sector_id) REFERENCES disciplina_annemasse.sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE disciplina_annemasse.companies_blacklist
  ADD CONSTRAINT fk_companies_blacklist_sector_id FOREIGN KEY (sector_id) REFERENCES disciplina_annemasse.sectors (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- `CREATE TABLE ... LIKE` copie les valeurs par défaut : booking_settings.timezone
-- arrive ici en 'Indian/Reunion' (cf. la CREATE TABLE de `disciplina` plus haut) alors
-- qu'Annemasse est en Europe/Paris. Sans cet ALTER, chaque page de réservation créée
-- par getOrCreate() afficherait des créneaux décalés de 2 h. La table est vide à ce
-- stade (volume neuf) : corriger le DEFAULT suffit, le backfill des lignes existantes
-- est fait par back/src/db/mysql/migrations.ts sur les bases déjà en service.
ALTER TABLE disciplina_annemasse.booking_settings
  MODIFY COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris';

-- Données de référence : copiées depuis `disciplina` (mêmes ids => même RBAC).
-- NB: sector_settings est copié en fin de fichier, après le seed disciplina.
INSERT IGNORE INTO disciplina_annemasse.permissions (id, name)
    SELECT id, name FROM disciplina.permissions;
INSERT IGNORE INTO disciplina_annemasse.roles (id, name)
    SELECT id, name FROM disciplina.roles;
INSERT IGNORE INTO disciplina_annemasse.external_references (id, name)
    SELECT id, name FROM disciplina.external_references;

-- Compte applicatif : le backend ne se connecte pas en `root`. Une injection SQL ou une
-- fuite de .env ne doit pas donner DROP DATABASE, GRANT, ni la lecture de `mysql.user`.
--
-- Le compte lui-même est créé par l'image mysql à partir de MYSQL_USER / MYSQL_PASSWORD
-- (le mot de passe ne transite donc pas par ce fichier versionné), mais avec ALL PRIVILEGES
-- sur la base — dont DROP. On resserre ici : CREATE/ALTER/INDEX/REFERENCES restent
-- nécessaires car back/src/db/mysql/migrations.ts fait évoluer le schéma au boot, et
-- CREATE TEMPORARY TABLES car les requêtes KPI utilisent des CTE (WITH ...) que MySQL
-- matérialise en tables temporaires. DROP et tout privilège global sont retirés :
-- sans DROP, `DROP DATABASE disciplina` est refusé.
--
-- ATTENTION : ce fichier n'est joué que sur un volume vierge (initdb).
REVOKE ALL PRIVILEGES ON `disciplina`.* FROM 'disciplina_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES
    ON `disciplina`.* TO 'disciplina_app'@'%';
-- Pas de REVOKE sur `disciplina_annemasse` : l'entrypoint de l'image ne grant
-- que MYSQL_DATABASE (disciplina). La seconde base n'a donc jamais reçu de
-- privilèges larges, le GRANT restreint ci-dessous suffit (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES
    ON `disciplina_annemasse`.* TO 'disciplina_app'@'%';
FLUSH PRIVILEGES;

INSERT IGNORE INTO sector_settings (sector, location) VALUES
    ('Nord-Est', 'Disciplina Nord-Est — Sainte-Marie'),
    ('Ouest', 'Disciplina Ouest — Saint-Paul'),
    ('Sud', 'Disciplina Sud — Saint-Pierre');

-- Lieu de RDV du tenant Annemasse (mono-secteur « Annemasse ») : volontairement
-- PAS une copie des zones Réunion ci-dessus (cf. GEO-11).
INSERT IGNORE INTO disciplina_annemasse.sector_settings (sector, location) VALUES
    ('Annemasse', 'Disciplina Annemasse');

-- Référentiel des secteurs (région > secteur > commune), source : ZONE_TO_COMMUNES.
-- Idempotent ; le backend (sectorsMigration.ts) complète au boot les bases existantes.
-- BEGIN sectors seed reunion
INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT 'REUNION', 'La Réunion', 'region', NULL;

INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT 'NORD', 'Nord-Est', 'sector', id FROM sectors WHERE level = 'region' AND code = 'REUNION';
INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT 'OUEST', 'Ouest', 'sector', id FROM sectors WHERE level = 'region' AND code = 'REUNION';
INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT 'SUD', 'Sud', 'sector', id FROM sectors WHERE level = 'region' AND code = 'REUNION';

INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'SAINT_DENIS' AS code, 'Saint Denis' AS label
  UNION ALL SELECT 'SAINTE_MARIE', 'Sainte Marie'
  UNION ALL SELECT 'SAINTE_SUZANNE', 'Sainte Suzanne'
  UNION ALL SELECT 'SAINTE_ROSE', 'Sainte Rose'
  UNION ALL SELECT 'SAINT_BENOIT', 'Saint Benoit'
  UNION ALL SELECT 'BRAS_PANON', 'Bras Panon'
  UNION ALL SELECT 'SAINT_ANDRE', 'Saint Andre'
  UNION ALL SELECT 'LA_PLAINE_DES_PALMISTES', 'La Plaine Des Palmistes'
  UNION ALL SELECT 'SALAZIE', 'Salazie'
  UNION ALL SELECT 'SAINTE_ANNE', 'Sainte Anne'
) v JOIN sectors p ON p.level = 'sector' AND p.code = 'NORD';

INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'SAINT_PAUL' AS code, 'Saint Paul' AS label
  UNION ALL SELECT 'SAINT_GILLES', 'Saint Gilles'
  UNION ALL SELECT 'LA_POSSESSION', 'La Possession'
  UNION ALL SELECT 'LE_PORT', 'Le Port'
  UNION ALL SELECT 'TROIS_BASSINS', 'Trois Bassins'
  UNION ALL SELECT 'SAINT_LEU', 'Saint Leu'
  UNION ALL SELECT 'LES_AVIRONS', 'Les Avirons'
) v JOIN sectors p ON p.level = 'sector' AND p.code = 'OUEST';

INSERT IGNORE INTO sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'SAINT_PIERRE' AS code, 'Saint Pierre' AS label
  UNION ALL SELECT 'SAINT_LOUIS', 'Saint Louis'
  UNION ALL SELECT 'ETANG_SALE', 'Etang Sale'
  UNION ALL SELECT 'LE_TAMPON', 'Le Tampon'
  UNION ALL SELECT 'SAINT_JOSEPH', 'Saint Joseph'
  UNION ALL SELECT 'SAINT_PHILLIPE', 'Saint Phillipe'
  UNION ALL SELECT 'PETIT_ILE', 'Petit Ile'
  UNION ALL SELECT 'CILAOS', 'Cilaos'
  UNION ALL SELECT 'ENTRE_DEUX', 'Entre Deux'
) v JOIN sectors p ON p.level = 'sector' AND p.code = 'SUD';

UPDATE sectors s JOIN sector_settings ss ON ss.sector = s.label SET s.location = ss.location WHERE s.level IN ('region', 'sector') AND s.location = '';
-- END sectors seed reunion

-- BEGIN sectors seed annemasse
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'ANNEMASSE', 'Annemasse', 'region', NULL;

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'GENEVE_FRONTIERE', 'Genève / Frontière', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'GENEVOIS', 'Saint-Julien / Genevois', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'ARVE', 'Arve', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'FAUCIGNY', 'Faucigny / La Roche', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'ANNECY', 'Annecy', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';
INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT 'CHABLAIS', 'Chablais', 'sector', id FROM disciplina_annemasse.sectors WHERE level = 'region' AND code = 'ANNEMASSE';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'ANNEMASSE' AS code, 'Annemasse' AS label
  UNION ALL SELECT 'AMBILLY', 'Ambilly'
  UNION ALL SELECT 'GAILLARD', 'Gaillard'
  UNION ALL SELECT 'VILLE_LA_GRAND', 'Ville La Grand'
  UNION ALL SELECT 'VETRAZ_MONTHOUX', 'Vetraz Monthoux'
  UNION ALL SELECT 'ETREMBIERES', 'Etrembieres'
  UNION ALL SELECT 'CRANVES_SALES', 'Cranves Sales'
  UNION ALL SELECT 'SAINT_CERGUES', 'Saint Cergues'
  UNION ALL SELECT 'JUVIGNY', 'Juvigny'
  UNION ALL SELECT 'BONNE', 'Bonne'
  UNION ALL SELECT 'MACHILLY', 'Machilly'
  UNION ALL SELECT 'DOUVAINE', 'Douvaine'
  UNION ALL SELECT 'VEIGY_FONCENEX', 'Veigy Foncenex'
  UNION ALL SELECT 'SCIEZ', 'Sciez'
  UNION ALL SELECT 'THONON_LES_BAINS', 'Thonon Les Bains'
  UNION ALL SELECT 'EVIAN_LES_BAINS', 'Evian Les Bains'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'GENEVE_FRONTIERE';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'SAINT_JULIEN_EN_GENEVOIS' AS code, 'Saint Julien En Genevois' AS label
  UNION ALL SELECT 'ARCHAMPS', 'Archamps'
  UNION ALL SELECT 'NEYDENS', 'Neydens'
  UNION ALL SELECT 'COLLONGES_SOUS_SALEVE', 'Collonges Sous Saleve'
  UNION ALL SELECT 'PRESILLY', 'Presilly'
  UNION ALL SELECT 'BEAUMONT', 'Beaumont'
  UNION ALL SELECT 'FEIGERES', 'Feigeres'
  UNION ALL SELECT 'VIRY', 'Viry'
  UNION ALL SELECT 'VALLEIRY', 'Valleiry'
  UNION ALL SELECT 'VULBENS', 'Vulbens'
  UNION ALL SELECT 'CHENEX', 'Chenex'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'GENEVOIS';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'REIGNIER_ESERY' AS code, 'Reignier Esery' AS label
  UNION ALL SELECT 'ARENTHON', 'Arenthon'
  UNION ALL SELECT 'CONTAMINE_SUR_ARVE', 'Contamine Sur Arve'
  UNION ALL SELECT 'BONNEVILLE', 'Bonneville'
  UNION ALL SELECT 'AYSE', 'Ayse'
  UNION ALL SELECT 'MARIGNIER', 'Marignier'
  UNION ALL SELECT 'VOUGY', 'Vougy'
  UNION ALL SELECT 'CLUSES', 'Cluses'
  UNION ALL SELECT 'SCIONZIER', 'Scionzier'
  UNION ALL SELECT 'MARNAZ', 'Marnaz'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'ARVE';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'LA_ROCHE_SUR_FORON' AS code, 'La Roche Sur Foron' AS label
  UNION ALL SELECT 'AMANCY', 'Amancy'
  UNION ALL SELECT 'SAINT_PIERRE_EN_FAUCIGNY', 'Saint Pierre En Faucigny'
  UNION ALL SELECT 'ETAUX', 'Etaux'
  UNION ALL SELECT 'CORNIER', 'Cornier'
  UNION ALL SELECT 'PERS_JUSSY', 'Pers Jussy'
  UNION ALL SELECT 'SCIENTRIER', 'Scientrier'
  UNION ALL SELECT 'ARBUSIGNY', 'Arbusigny'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'FAUCIGNY';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'ANNECY' AS code, 'Annecy' AS label
  UNION ALL SELECT 'PRINGY', 'Pringy'
  UNION ALL SELECT 'EPAGNY_METZ_TESSY', 'Epagny Metz Tessy'
  UNION ALL SELECT 'POISY', 'Poisy'
  UNION ALL SELECT 'MEYTHET', 'Meythet'
  UNION ALL SELECT 'SEYNOD', 'Seynod'
  UNION ALL SELECT 'CRAN_GEVRIER', 'Cran Gevrier'
  UNION ALL SELECT 'ARGONAY', 'Argonay'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'ANNECY';

INSERT IGNORE INTO disciplina_annemasse.sectors (code, label, level, parent_id)
SELECT v.code, v.label, 'commune', p.id
FROM (
  SELECT 'BONS_EN_CHABLAIS' AS code, 'Bons En Chablais' AS label
  UNION ALL SELECT 'PERRIGNIER', 'Perrignier'
  UNION ALL SELECT 'BOEGE', 'Boege'
  UNION ALL SELECT 'FILLINGES', 'Fillinges'
  UNION ALL SELECT 'VIUZ_EN_SALLAZ', 'Viuz En Sallaz'
  UNION ALL SELECT 'SAINT_JEOIRE', 'Saint Jeoire'
) v JOIN disciplina_annemasse.sectors p ON p.level = 'sector' AND p.code = 'CHABLAIS';

UPDATE disciplina_annemasse.sectors s JOIN disciplina_annemasse.sector_settings ss ON ss.sector = s.label SET s.location = ss.location WHERE s.level IN ('region', 'sector') AND s.location = '';
-- END sectors seed annemasse
