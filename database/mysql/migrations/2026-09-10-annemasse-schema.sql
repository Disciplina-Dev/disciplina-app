-- Création de la base secondaire `disciplina_annemasse` (multi-tenant — site
-- Annemasse) sur une instance MySQL EXISTANTE (volume Docker déjà initialisé
-- ou prod auto-hébergée).
--
-- mysql-init.sql ne s'applique qu'à un volume vierge : sur une instance déjà en
-- service, seul ce fichier crée la seconde base. Il clone le schéma courant de
-- `disciplina` (colonnes, index et colonnes générées via CREATE TABLE ... LIKE)
-- SANS les trois tables deprecated (interview_access / match_link / external_link,
-- remplacées par external_access), puis recrée les clés étrangères que LIKE ne
-- copie pas, et rejoue les données de référence.
--
-- Ré-exécutable :
--   - CREATE TABLE IF NOT EXISTS ... LIKE : idempotent.
--   - Clés étrangères : ajoutées uniquement si absentes via la procédure
--     add_fk_if_missing (supprimée en fin de script). MySQL ne supportant ni
--     ADD CONSTRAINT IF NOT EXISTS ni DROP FOREIGN KEY IF EXISTS, c'est la seule
--     façon propre d'être idempotent hors trigger/procédure.
--   - Grants : REVOKE IF EXISTS + GRANT (idempotent, pattern de 2026-08-06-app-user.sql).
--
-- Usage (instance locale ou remote, user root) :
--   mysql -u root -p < database/mysql/migrations/2026-09-10-annemasse-schema.sql

CREATE DATABASE IF NOT EXISTS disciplina_annemasse;

-- CREATE PROCEDURE exige une base courante quand le script est joué sans
-- sélection préalable (mysql -u root -p < fichier).
USE disciplina_annemasse;

-- ── Clonage du schéma courant de `disciplina` ─────────────────────────────
CREATE TABLE IF NOT EXISTS disciplina_annemasse.app_settings LIKE disciplina.app_settings;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.permissions LIKE disciplina.permissions;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.roles LIKE disciplina.roles;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.users LIKE disciplina.users;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.booking_settings LIKE disciplina.booking_settings;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.companies LIKE disciplina.companies;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.company_conflict LIKE disciplina.company_conflict;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.companies_blacklist LIKE disciplina.companies_blacklist;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.company_history LIKE disciplina.company_history;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.contact_logs LIKE disciplina.contact_logs;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.filiz LIKE disciplina.filiz;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.external_references LIKE disciplina.external_references;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.external_access LIKE disciplina.external_access;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.peda_config LIKE disciplina.peda_config;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.peda_draft_history LIKE disciplina.peda_draft_history;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.refresh_tokens LIKE disciplina.refresh_tokens;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.relance_history LIKE disciplina.relance_history;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.sector_settings LIKE disciplina.sector_settings;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.todo_groups LIKE disciplina.todo_groups;
CREATE TABLE IF NOT EXISTS disciplina_annemasse.todos LIKE disciplina.todos;

-- ── Clés étrangères (LIKE ne les copie pas) ───────────────────────────────
DELIMITER //
DROP PROCEDURE IF EXISTS add_fk_if_missing//
CREATE PROCEDURE add_fk_if_missing(IN p_constraint VARCHAR(128), IN p_alter_sql TEXT)
BEGIN
  DECLARE cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO cnt
    FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = 'disciplina_annemasse'
     AND CONSTRAINT_NAME = p_constraint
     AND CONSTRAINT_TYPE = 'FOREIGN KEY';
  IF cnt = 0 THEN
    SET @sql = p_alter_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL add_fk_if_missing('fk_users_role_id', 'ALTER TABLE disciplina_annemasse.users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES disciplina_annemasse.roles (id) ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_users_permission_id', 'ALTER TABLE disciplina_annemasse.users ADD CONSTRAINT fk_users_permission_id FOREIGN KEY (permission_id) REFERENCES disciplina_annemasse.permissions (id) ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_booking_settings_user_id', 'ALTER TABLE disciplina_annemasse.booking_settings ADD CONSTRAINT fk_booking_settings_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_companies_user_id', 'ALTER TABLE disciplina_annemasse.companies ADD CONSTRAINT fk_companies_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_company_conflict_user_id', 'ALTER TABLE disciplina_annemasse.company_conflict ADD CONSTRAINT fk_company_conflict_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_companies_blacklist_user_id', 'ALTER TABLE disciplina_annemasse.companies_blacklist ADD CONSTRAINT fk_companies_blacklist_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_company_history_company_id', 'ALTER TABLE disciplina_annemasse.company_history ADD CONSTRAINT fk_company_history_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_contact_logs_company_id', 'ALTER TABLE disciplina_annemasse.contact_logs ADD CONSTRAINT fk_contact_logs_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_contact_logs_user_id', 'ALTER TABLE disciplina_annemasse.contact_logs ADD CONSTRAINT fk_contact_logs_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_ext_access_reference', 'ALTER TABLE disciplina_annemasse.external_access ADD CONSTRAINT fk_ext_access_reference FOREIGN KEY (reference_id) REFERENCES disciplina_annemasse.external_references (id)');
CALL add_fk_if_missing('fk_ext_access_user', 'ALTER TABLE disciplina_annemasse.external_access ADD CONSTRAINT fk_ext_access_user FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id)');
CALL add_fk_if_missing('fk_peda_config_user_id', 'ALTER TABLE disciplina_annemasse.peda_config ADD CONSTRAINT fk_peda_config_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_peda_draft_history_user_id', 'ALTER TABLE disciplina_annemasse.peda_draft_history ADD CONSTRAINT fk_peda_draft_history_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_refresh_tokens_user_id', 'ALTER TABLE disciplina_annemasse.refresh_tokens ADD CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_relance_history_company_id', 'ALTER TABLE disciplina_annemasse.relance_history ADD CONSTRAINT fk_relance_history_company_id FOREIGN KEY (company_id) REFERENCES disciplina_annemasse.companies (id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_relance_history_user_id', 'ALTER TABLE disciplina_annemasse.relance_history ADD CONSTRAINT fk_relance_history_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL add_fk_if_missing('fk_todo_groups_user_id', 'ALTER TABLE disciplina_annemasse.todo_groups ADD CONSTRAINT fk_todo_groups_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE');
CALL add_fk_if_missing('fk_todos_user_id', 'ALTER TABLE disciplina_annemasse.todos ADD CONSTRAINT fk_todos_user_id FOREIGN KEY (user_id) REFERENCES disciplina_annemasse.users (id) ON DELETE CASCADE');
CALL add_fk_if_missing('fk_todos_assigned_by', 'ALTER TABLE disciplina_annemasse.todos ADD CONSTRAINT fk_todos_assigned_by FOREIGN KEY (assigned_by) REFERENCES disciplina_annemasse.users (id) ON DELETE SET NULL');
CALL add_fk_if_missing('fk_todos_group_id', 'ALTER TABLE disciplina_annemasse.todos ADD CONSTRAINT fk_todos_group_id FOREIGN KEY (group_id) REFERENCES disciplina_annemasse.todo_groups (id) ON DELETE SET NULL');

DROP PROCEDURE IF EXISTS add_fk_if_missing;

-- ── Données de référence (copiées depuis `disciplina`, mêmes ids => même RBAC) ──
INSERT IGNORE INTO disciplina_annemasse.permissions (id, name)
    SELECT id, name FROM disciplina.permissions;
INSERT IGNORE INTO disciplina_annemasse.roles (id, name)
    SELECT id, name FROM disciplina.roles;
INSERT IGNORE INTO disciplina_annemasse.external_references (id, name)
    SELECT id, name FROM disciplina.external_references;
INSERT IGNORE INTO disciplina_annemasse.sector_settings (sector, location)
    SELECT sector, location FROM disciplina.sector_settings;

-- ── Droits du compte applicatif sur la seconde base ───────────────────────
-- Mêmes limitations que sur `disciplina` (pattern 2026-08-06-app-user.sql) :
-- pas de DROP, pas de GRANT, pas de privilège global.
REVOKE IF EXISTS ALL PRIVILEGES ON `disciplina_annemasse`.* FROM 'disciplina_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES
    ON `disciplina_annemasse`.* TO 'disciplina_app'@'%';
FLUSH PRIVILEGES;

-- Vérification : 20 tables, 20 clés étrangères, aucune table deprecated.
SELECT CONCAT('tables: ', COUNT(*)) AS check_result
  FROM information_schema.tables
 WHERE table_schema = 'disciplina_annemasse';
SELECT CONCAT('fk: ', COUNT(*)) AS check_result
  FROM information_schema.referential_constraints
 WHERE constraint_schema = 'disciplina_annemasse';