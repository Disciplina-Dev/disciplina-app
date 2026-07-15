SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS disciplina;
USE disciplina;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(64) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

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
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  KEY `fk_1` (`user_id`),
  UNIQUE KEY `unique_kpi` (`user_id`,`year`,`month`,`week`,`site`),
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `companies` (
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
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `relance_channel` enum('PHONE','MAIL') DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `siret` (`siret`),
  KEY `fk_1` (`user_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
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
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `all_blacklist` tinyint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `siret` (`siret`),
  KEY `fk_1` (`user_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `company_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_column` text NOT NULL,
  `status` varchar(50) NOT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `modified_by` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_1` (`company_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  CONSTRAINT `fk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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

CREATE TABLE IF NOT EXISTS `needs_analysis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `user_id` int NOT NULL,
  `legal_rep_function` varchar(255) DEFAULT NULL,
  `recruitment_responsible_name` varchar(255) DEFAULT NULL,
  `recruitment_responsible_phone` varchar(50) DEFAULT NULL,
  `recruitment_responsible_email` varchar(255) DEFAULT NULL,
  `recruitment_responsible_function` varchar(255) DEFAULT NULL,
  `company_sectors` json DEFAULT NULL,
  `company_description` text DEFAULT NULL,
  `opco` enum('AKTO','ATLAS','AFDAS','CONSTRUCTYS','OCAPIAT','OPCO_2I','OPCO_EP','OPCO_MOBILITES','OPCO_SANTE','OPCOMMERCE','UNIFORMATION') DEFAULT NULL,
  `referral_source` enum('KOANN','E2CR','FRANCE_TRAVAIL','TELEVISION_PUB','BOUCHE_A_OREILLE','MISSION_LOCALE','SALON','RSMA','RESEAUX_SOCIAUX') DEFAULT NULL,
  `positions_count` int NOT NULL DEFAULT '1',
  `positions` json DEFAULT NULL,
  `localisation` enum('NORD','OUEST','SUD') NOT NULL,
  `training_domain` enum('SECRETARIAT','VENTE') NOT NULL,
  `job_title` varchar(255) NOT NULL,
  `selected_missions` json NOT NULL,
  `other_missions` text DEFAULT NULL,
  `job_description_missions` json DEFAULT NULL,
  `job_description_other` text DEFAULT NULL,
  `education_level` enum('BAC','BAC_PLUS_2','BAC_PLUS_3') DEFAULT NULL,
  `driving_license` enum('OUI','OPTIONNEL') NOT NULL,
  `experience_required` enum('DEBUTANT','OBLIGATOIRE') NOT NULL,
  `age_requirements` json NOT NULL,
  `age_min` int DEFAULT NULL,
  `age_max` int DEFAULT NULL,
  `soft_skills` text DEFAULT NULL,
  `schedule_options` json DEFAULT NULL,
  `conditions` text DEFAULT NULL,
  `additional_comments` text DEFAULT NULL,
  `recruitment_method` enum('ALL_CV','PRESELECTION','PRE_INTERVIEW') NOT NULL,
  `immersion_period` enum('OUI','NON','A_DISCUTER') NOT NULL,
  `training_days` json NOT NULL,
  `yousign_signature_request_id` varchar(255) DEFAULT NULL,
  `status` enum('BROUILLON','EN_ATTENTE_SIGNATURE','SIGNE','EXPIRE') NOT NULL DEFAULT 'BROUILLON',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_1` (`company_id`),
  KEY `fk_2` (`user_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `peda_config` (
  `user_id` int NOT NULL,
  `sheet_id` varchar(128) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`) /*T![clustered_index] CLUSTERED */,
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  KEY `fk_1` (`user_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
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
  KEY `fk_2` (`user_id`),
  CONSTRAINT `fk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
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
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  CONSTRAINT `fk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMIN','RESPONSABLE','COMMERCIAL','RH','PEDA') NOT NULL,
  `sectors` json DEFAULT NULL,
  `oauth_token` text DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `is_interviewer` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO sector_settings (sector, location) VALUES
    ('Nord-Est', 'Disciplina Nord-Est — Sainte-Marie'),
    ('Ouest', 'Disciplina Ouest — Saint-Paul'),
    ('Sud', 'Disciplina Sud — Saint-Pierre');
