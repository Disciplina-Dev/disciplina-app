-- Compte applicatif non-root, pour les bases EXISTANTES.
--
-- mysql-init.sql n'est joué que sur un volume vierge : sur une base déjà initialisée
-- (volume Docker local, prod auto-hébergée), le compte `disciplina_app` n'existe pas et
-- le backend continue de se connecter en root. Ce script comble l'écart.
--
-- Remplacer <MOT_DE_PASSE> par la valeur de MYSQL_PASSWORD du .env avant exécution :
--   mysql -u root -p < database/mysql/migrations/2026-08-06-app-user.sql
--
-- Droits accordés : lecture/écriture des données, évolution du schéma (migrations.ts fait
-- des CREATE/ALTER TABLE au boot) et tables temporaires (les requêtes KPI utilisent des
-- CTE que MySQL matérialise). Volontairement absents : DROP, GRANT, et tout privilège
-- global — donc pas de DROP DATABASE ni de lecture de `mysql.user`.

CREATE USER IF NOT EXISTS 'disciplina_app'@'%' IDENTIFIED BY '<MOT_DE_PASSE>';

-- IF EXISTS : sur un compte fraîchement créé il n'y a rien à révoquer, et un REVOKE nu
-- échouerait (ERROR 1141). Le client mysql s'arrêtant à la première erreur, le GRANT
-- suivant ne serait pas exécuté et le compte resterait sans aucun droit.
REVOKE IF EXISTS ALL PRIVILEGES ON `disciplina`.* FROM 'disciplina_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES
    ON `disciplina`.* TO 'disciplina_app'@'%';
FLUSH PRIVILEGES;

-- Vérification : doit lister exactement le GRANT ci-dessus, et rien sur *.*
SHOW GRANTS FOR 'disciplina_app'@'%';
