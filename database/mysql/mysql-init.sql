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
  (3, 'ADMIN');

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
  (5, 'GESTION');

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

CREATE TABLE IF NOT EXISTS `commercial_kpi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(255) NOT NULL,
  `year` year(4) NOT NULL,
  `month` tinyint NOT NULL,
  `week` tinyint NOT NULL DEFAULT '0',
  `site` enum('NORD','OUEST','SUD') NOT NULL DEFAULT 'NORD',
  `count_oui` int NOT NULL DEFAULT '0',
  `count_oui_of` int NOT NULL DEFAULT '0',
  `count_non` int NOT NULL DEFAULT '0',
  `count_ne_repond_pas` int NOT NULL DEFAULT '0',
  `count_a_reflechir` int NOT NULL DEFAULT '0',
  `count_relance` int NOT NULL DEFAULT '0',
  `total_appels` int NOT NULL DEFAULT '0',
  `total_trie` int NOT NULL DEFAULT '0',
  `nbre_ent_ferme` int NOT NULL DEFAULT '0',
  `nbre_ent_ouvert` int NOT NULL DEFAULT '0',
  `visites_terrain` int NOT NULL DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
--   KEY `idx_commercial_kpi_user_id` (`user_id`),
  UNIQUE KEY `unique_kpi` (`user_id`,`year`,`month`,`week`,`site`),
  CONSTRAINT `fk_commercial_kpi_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
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
  CONSTRAINT `fk_companies_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
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
  CONSTRAINT `fk_company_conflict_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `companies_blacklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `legal_referent` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(255) NOT NULL,
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
  CONSTRAINT `fk_companies_blacklist_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
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

CREATE TABLE IF NOT EXISTS `interview_access` (
  `signature` char(64) NOT NULL,
  `code` char(6) NOT NULL,
  `offer_uuid` varchar(64) NOT NULL,
  `candidate_id` varchar(64) NOT NULL,
  `rh_email` varchar(255) NOT NULL,
  `status` enum('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `attempts` tinyint NOT NULL DEFAULT '0',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_interview_access_job` (`offer_uuid`),
  KEY `idx_interview_access_candidate` (`candidate_id`),
  PRIMARY KEY (`signature`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `match_link` (
  `signature` char(64) NOT NULL,
  `code` char(6) NOT NULL,
  `identifier` varchar(32) NOT NULL,
  `rh_email` varchar(255) NOT NULL,
  `company_email` varchar(255) NOT NULL,
  `offer_uuid` varchar(64) NOT NULL,
  `status` enum('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `attempts` tinyint NOT NULL DEFAULT '0',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`signature`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `external_link` (
  `id`             int           NOT NULL AUTO_INCREMENT,
  `signature`      char(128)    NOT NULL,
  `code`           char(6)      NOT NULL,
  `external_email` varchar(255) NOT NULL,
  `rh_email`       varchar(255) NOT NULL,
  `guest_type`     enum('COMPANY','CANDIDATE') NOT NULL,
  `external_uuid`  varchar(64)  NOT NULL,
  `status`         enum('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `attempts`       tinyint      NOT NULL DEFAULT '0',
  `expires_at`     timestamp    NOT NULL,
  `created_at`     timestamp    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     timestamp    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uk_signature` (`signature`),
  KEY `idx_external_uuid` (`external_uuid`),
  KEY `idx_guest_type` (`guest_type`)
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

CREATE TABLE IF NOT EXISTS `rh_kpi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sector` varchar(64) NOT NULL DEFAULT '',
  `year` smallint NOT NULL,
  `month` tinyint NOT NULL,
  `week` tinyint NOT NULL,
  `interviews_placed` int NOT NULL DEFAULT '0',
  `interviews_attended` int NOT NULL DEFAULT '0',
  `interviews_noshow` int NOT NULL DEFAULT '0',
  `immersions` int NOT NULL DEFAULT '0',
  `contracts` int NOT NULL DEFAULT '0',
  `ruptures` int NOT NULL DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_rh_kpi_sector` (`user_id`,`sector`,`year`,`month`,`week`),
  CONSTRAINT `fk_rh_kpi_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `sector_settings` (
  `sector` varchar(64) NOT NULL,
  `location` varchar(255) NOT NULL DEFAULT '',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sector`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `todos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
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
  CONSTRAINT `fk_todos_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

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
-- ATTENTION : ce fichier n'est joué que sur un volume vierge. Sur une base existante,
-- appliquer database/mysql/migrations/2026-08-06-app-user.sql.
REVOKE ALL PRIVILEGES ON `disciplina`.* FROM 'disciplina_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES
    ON `disciplina`.* TO 'disciplina_app'@'%';
FLUSH PRIVILEGES;

INSERT IGNORE INTO sector_settings (sector, location) VALUES
    ('Nord-Est', 'Disciplina Nord-Est — Sainte-Marie'),
    ('Ouest', 'Disciplina Ouest — Saint-Paul'),
    ('Sud', 'Disciplina Sud — Saint-Pierre');
