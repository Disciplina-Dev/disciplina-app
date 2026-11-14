#!/bin/bash
# Automated MySQL + MongoDB backup with rotation, meant to be run daily via launchd
# on the deployment Mac mini. See "## Backups" in the root README.md.
#
# Dumps are encrypted with age (public-key) as they are produced: the plaintext
# never touches the disk. Only the public recipient (BACKUP_AGE_RECIPIENT in .env)
# lives on this machine; the private identity is kept off-machine and is needed
# only to restore. See "Backup encryption" in HOWTODEPLOY.md.
set -euo pipefail

# Dumps must never be readable by other local users.
umask 077

RETENTION_DAYS=7

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/mongo-exec.sh
source "$REPO_ROOT/scripts/mongo-exec.sh"
# shellcheck source=scripts/notify.sh
source "$REPO_ROOT/scripts/notify.sh"

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

AGE_RECIPIENT="$(load_env_opt BACKUP_AGE_RECIPIENT)"
if ! command -v age >/dev/null 2>&1; then
    echo "Erreur : 'age' introuvable dans le PATH (brew install age)" >&2
    exit 1
fi
if [[ ! "$AGE_RECIPIENT" =~ ^age1[a-z0-9]+$ ]]; then
    echo "Erreur : BACKUP_AGE_RECIPIENT absent ou invalide dans .env (clé PUBLIQUE age1…, voir HOWTODEPLOY.md)" >&2
    exit 1
fi

DATE=$(date +%Y-%m-%d_%H%M%S)
mkdir -p backups
chmod 700 backups

# Un échec en cours de route ne doit laisser aucun fichier partiel dans backups/,
# et doit déclencher une alerte webhook (BACKUP_ALERT_WEBHOOK, voir notify.sh).
on_exit() {
    local rc=$?
    rm -f backups/*.part
    if ((rc != 0)); then
        notify_failure "Backup FAILED" "backup-db.sh exit ${rc}"
    fi
}
trap on_exit EXIT

# sha256 d'un fichier : sha256sum (Linux) ou shasum (macOS).
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -- "$1"
    else
        shasum -a 256 -- "$1"
    fi
}

# dump_encrypted <fichier final> <commande de dump…>
# Le dump est chiffré à la volée vers <fichier>.part puis renommé : un dump
# interrompu (pipefail) n'est jamais exposé sous son nom final, et rien n'est
# écrit en clair sur le disque.
dump_encrypted() {
    local out="$1"
    shift
    "$@" | age -r "$AGE_RECIPIENT" > "${out}.part"
    chmod 600 "${out}.part"
    mv "${out}.part" "$out"
    # Checksum ecrit a la sauvegarde (nom de fichier relatif : verifiable depuis backups/).
    (cd "$(dirname "$out")" && sha256_of "$(basename "$out")" > "$(basename "$out").sha256")
    chmod 600 "${out}.sha256"
}

echo "[$(date -Iseconds)] Starting backup"

MYSQL_DUMP="backups/backup_mysql_${DATE}.sql.age"
dump_encrypted "$MYSQL_DUMP" \
  env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db mysqldump -h127.0.0.1 -uroot disciplina
echo "[$(date -Iseconds)] MySQL dump done: $MYSQL_DUMP ($(du -h "$MYSQL_DUMP" | cut -f1))"

MONGO_DUMP="backups/backup_mongo_${DATE}.archive.age"
dump_encrypted "$MONGO_DUMP" \
  mongo_exec mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --authenticationDatabase admin --db human_ressources --archive
echo "[$(date -Iseconds)] MongoDB dump done: $MONGO_DUMP ($(du -h "$MONGO_DUMP" | cut -f1))"

# Nommage backup_annemasse_* : volontairement hors des globs backup_mysql_* /
# backup_mongo_* utilisés par deploy.sh pour retrouver le dump du tenant Réunion.
MYSQL_ANNEMASSE_DUMP="backups/backup_annemasse_mysql_${DATE}.sql.age"
dump_encrypted "$MYSQL_ANNEMASSE_DUMP" \
  env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db mysqldump -h127.0.0.1 -uroot "$MYSQL_ANNEMASSE_DATABASE"
echo "[$(date -Iseconds)] MySQL Annemasse dump done: $MYSQL_ANNEMASSE_DUMP ($(du -h "$MYSQL_ANNEMASSE_DUMP" | cut -f1))"

MONGO_ANNEMASSE_DUMP="backups/backup_annemasse_mongo_${DATE}.archive.age"
dump_encrypted "$MONGO_ANNEMASSE_DUMP" \
  mongo_exec mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --authenticationDatabase admin --db "$MONGO_ANNEMASSE_DATABASE" --archive
echo "[$(date -Iseconds)] MongoDB Annemasse dump done: $MONGO_ANNEMASSE_DUMP ($(du -h "$MONGO_ANNEMASSE_DUMP" | cut -f1))"

find backups -name 'backup_mysql_*.sql.age' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_mysql_*.sql.age.sha256' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_mongo_*.archive.age' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_mongo_*.archive.age.sha256' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mysql_*.sql.age' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mysql_*.sql.age.sha256' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mongo_*.archive.age' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'backup_annemasse_mongo_*.archive.age.sha256' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup finished, rotation applied (retention: ${RETENTION_DAYS}d)"
