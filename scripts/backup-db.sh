#!/bin/bash
# Automated MySQL + MongoDB backup with rotation, meant to be run daily via launchd
# on the deployment Mac mini. See "## Backups" in the root README.md.
set -euo pipefail

RETENTION_DAYS=7

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# .env contient des valeurs avec métacaractères shell (ex. `&` dans MONGO_URI),
# donc `source .env` échoue en parse error. On n'extrait que les clés nécessaires.
load_env() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2-
}
# Clé facultative : absente de .env → vide (grep=1 ferait sinon échouer pipefail).
load_env_opt() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2- || true
}
MYSQL_ROOT_PASSWORD="$(load_env MYSQL_ROOT_PASSWORD)"
MONGO_ROOT_USERNAME="$(load_env MONGO_ROOT_USERNAME)"
MONGO_ROOT_PASSWORD="$(load_env MONGO_ROOT_PASSWORD)"
# Tenant Annemasse : mêmes conteneurs, bases distinctes (défaut = .env.example).
MYSQL_ANNEMASSE_DATABASE="$(load_env_opt MYSQL_ANNEMASSE_DATABASE)"
MYSQL_ANNEMASSE_DATABASE="${MYSQL_ANNEMASSE_DATABASE:-disciplina_annemasse}"
MONGO_ANNEMASSE_DATABASE="$(load_env_opt MONGO_ANNEMASSE_DATABASE)"
MONGO_ANNEMASSE_DATABASE="${MONGO_ANNEMASSE_DATABASE:-disciplina_annemasse}"

DATE=$(date +%Y-%m-%d_%H%M%S)
mkdir -p backups

echo "[$(date -Iseconds)] Starting backup"

MYSQL_DUMP="backups/backup_mysql_${DATE}.sql"
docker compose exec -T sql-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" disciplina > "$MYSQL_DUMP"
echo "[$(date -Iseconds)] MySQL dump done: $MYSQL_DUMP ($(du -h "$MYSQL_DUMP" | cut -f1))"

MONGO_DUMP="backups/backup_mongo_${DATE}.archive"
docker compose exec -T nosql-db mongodump \
  --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --db human_ressources --archive > "$MONGO_DUMP"
echo "[$(date -Iseconds)] MongoDB dump done: $MONGO_DUMP ($(du -h "$MONGO_DUMP" | cut -f1))"

# Nommage backup_annemasse_* : volontairement hors des globs backup_mysql_* /
# backup_mongo_* utilisés par deploy.sh pour retrouver le dump du tenant Réunion.
MYSQL_ANNEMASSE_DUMP="backups/backup_annemasse_mysql_${DATE}.sql"
docker compose exec -T sql-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_ANNEMASSE_DATABASE" > "$MYSQL_ANNEMASSE_DUMP"
echo "[$(date -Iseconds)] MySQL Annemasse dump done: $MYSQL_ANNEMASSE_DUMP ($(du -h "$MYSQL_ANNEMASSE_DUMP" | cut -f1))"

MONGO_ANNEMASSE_DUMP="backups/backup_annemasse_mongo_${DATE}.archive"
docker compose exec -T nosql-db mongodump \
  --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --db "$MONGO_ANNEMASSE_DATABASE" --archive > "$MONGO_ANNEMASSE_DUMP"
echo "[$(date -Iseconds)] MongoDB Annemasse dump done: $MONGO_ANNEMASSE_DUMP ($(du -h "$MONGO_ANNEMASSE_DUMP" | cut -f1))"

find backups -name 'backup_mysql_*.sql' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_mongo_*.archive' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mysql_*.sql' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mongo_*.archive' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup finished, rotation applied (retention: ${RETENTION_DAYS}d)"
