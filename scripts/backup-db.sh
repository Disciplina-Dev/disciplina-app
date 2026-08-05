#!/bin/bash
# Automated MySQL + MongoDB backup with rotation, meant to be run daily via launchd
# on the deployment Mac mini. See "## Backups" in the root README.md.
set -euo pipefail

RETENTION_DAYS=7

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

set -a
source .env
set +a

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

find backups -name 'backup_mysql_*.sql' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_mongo_*.archive' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup finished, rotation applied (retention: ${RETENTION_DAYS}d)"
