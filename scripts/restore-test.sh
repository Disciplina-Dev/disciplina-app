#!/bin/bash
# Test de restauration des sauvegardes (RGPD Art. 32 : "tester regulierement").
# Prend le dernier dump de chaque base dans backups/, verifie son .sha256, le
# dechiffre (age) et le restaure dans des conteneurs MySQL/Mongo JETABLES (sans
# port publie, mots de passe aleatoires, supprimes en sortie). Ne touche jamais
# aux conteneurs ni aux volumes de dev/prod.
#
# Succes -> horodatage ISO ecrit dans backups/.last-restore-test (lu par deploy.sh).
# Echec  -> alerte webhook (scripts/notify.sh) + exit non nul.
#
# Requiert BACKUP_AGE_IDENTITY (chemin du fichier de cle PRIVEE age, hors depot),
# dans l'environnement ou dans .env. Voir "Backup restore test" dans HOWTODEPLOY.md.
set -euo pipefail
umask 077

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/notify.sh
source "$REPO_ROOT/scripts/notify.sh"

load_env_opt() {
    grep -E "^${1}=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true
}

# Memes tags que docker-compose.yaml.
MYSQL_IMAGE="mysql:8.4.8"
MONGO_IMAGE="mongo:8.2.6"

MYSQL_DB="disciplina"
MONGO_DB="human_ressources"
MYSQL_ANNEMASSE_DB="$(load_env_opt MYSQL_ANNEMASSE_DATABASE)"
MYSQL_ANNEMASSE_DB="${MYSQL_ANNEMASSE_DB:-disciplina_annemasse}"
MONGO_ANNEMASSE_DB="$(load_env_opt MONGO_ANNEMASSE_DATABASE)"
MONGO_ANNEMASSE_DB="${MONGO_ANNEMASSE_DB:-disciplina_annemasse}"

BACKUP_AGE_IDENTITY="${BACKUP_AGE_IDENTITY:-$(load_env_opt BACKUP_AGE_IDENTITY)}"

SUFFIX="$$-$(date +%s)"
MYSQL_CT="disciplina-restore-test-mysql-${SUFFIX}"
MONGO_CT="disciplina-restore-test-mongo-${SUFFIX}"
# Mot de passe jetable : transmis aux clients via l'environnement (-e VAR), jamais en argument.
MYSQL_PWD="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
export MYSQL_PWD

TMP_DIR=""
cleanup() {
    local rc=$?
    docker rm -f "$MYSQL_CT" "$MONGO_CT" >/dev/null 2>&1 || true
    [[ -n "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
    if ((rc != 0)); then
        notify_failure "Restore test FAILED" "restore-test.sh exit ${rc}"
    fi
}
trap cleanup EXIT

fail() {
    echo "Erreur : $*" >&2
    exit 1
}
log() { echo "[$(date -Iseconds)] $*"; }

command -v age >/dev/null 2>&1 || fail "'age' introuvable dans le PATH"
command -v docker >/dev/null 2>&1 || fail "'docker' introuvable dans le PATH"
[[ -n "$BACKUP_AGE_IDENTITY" && -r "$BACKUP_AGE_IDENTITY" ]] \
    || fail "BACKUP_AGE_IDENTITY absent ou fichier illisible (cle privee age, voir HOWTODEPLOY.md)"

TMP_DIR="$(mktemp -d)"

# latest <glob> : dump le plus recent (le nom contient la date, tri lexical).
latest() {
    local f
    f="$(ls -1 backups/${1} 2>/dev/null | sort | tail -1)"
    [[ -n "$f" ]] || fail "aucun dump ne correspond a backups/${1}"
    echo "$f"
}

# verify_checksum <dump> : relance sha256 depuis backups/ et compare au .sha256.
verify_checksum() {
    local dir base
    dir="$(dirname "$1")"
    base="$(basename "$1")"
    [[ -f "$1.sha256" ]] || fail "checksum manquant : $1.sha256"
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "$dir" && sha256sum -c --quiet "${base}.sha256") || fail "checksum invalide : $1"
    else
        (cd "$dir" && shasum -a 256 -c --quiet "${base}.sha256") || fail "checksum invalide : $1"
    fi
}

decrypt() { age -d -i "$BACKUP_AGE_IDENTITY" "$1"; }

MYSQL_DUMP="$(latest 'backup_mysql_*.sql.age')"
MONGO_DUMP="$(latest 'backup_mongo_*.archive.age')"
MYSQL_ANNEMASSE_DUMP="$(latest 'backup_annemasse_mysql_*.sql.age')"
MONGO_ANNEMASSE_DUMP="$(latest 'backup_annemasse_mongo_*.archive.age')"

log "Verification des checksums"
for dump in "$MYSQL_DUMP" "$MONGO_DUMP" "$MYSQL_ANNEMASSE_DUMP" "$MONGO_ANNEMASSE_DUMP"; do
    verify_checksum "$dump"
done

log "Demarrage des conteneurs jetables"
docker run -d --rm --name "$MYSQL_CT" -e MYSQL_ROOT_PASSWORD="$MYSQL_PWD" "$MYSQL_IMAGE" >/dev/null
docker run -d --rm --name "$MONGO_CT" "$MONGO_IMAGE" >/dev/null

mysql_exec() { docker exec -i -e MYSQL_PWD "$MYSQL_CT" mysql -h127.0.0.1 -uroot "$@"; }

# Le MySQL de l'image redemarre apres l'init : on attend le serveur reseau definitif.
ready=0
for _ in $(seq 1 60); do
    if mysql_exec -e 'SELECT 1' >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 2
done
((ready)) || fail "MySQL jetable non pret apres 120 s"

ready=0
for _ in $(seq 1 30); do
    if docker exec "$MONGO_CT" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 2
done
((ready)) || fail "Mongo jetable non pret apres 60 s"

# restore_mysql <dump> <base>
restore_mysql() {
    mysql_exec -e "CREATE DATABASE \`$2\`"
    decrypt "$1" | mysql_exec "$2"
    local n
    n="$(mysql_exec -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$2'")"
    ((n > 0)) || fail "MySQL $2 restaure sans aucune table"
    log "MySQL $2 restaure ($n tables)"
}

# restore_mongo <dump> <base>
restore_mongo() {
    decrypt "$1" | docker exec -i "$MONGO_CT" mongorestore --archive --nsInclude "$2.*" >/dev/null 2>&1
    local n
    n="$(docker exec "$MONGO_CT" mongosh --quiet --eval "db.getSiblingDB('$2').getCollectionNames().length")"
    ((n > 0)) || fail "Mongo $2 restaure sans aucune collection"
    log "Mongo $2 restaure ($n collections)"
}

restore_mysql "$MYSQL_DUMP" "$MYSQL_DB"
restore_mysql "$MYSQL_ANNEMASSE_DUMP" "$MYSQL_ANNEMASSE_DB"
restore_mongo "$MONGO_DUMP" "$MONGO_DB"
restore_mongo "$MONGO_ANNEMASSE_DUMP" "$MONGO_ANNEMASSE_DB"

date -Iseconds > backups/.last-restore-test
chmod 600 backups/.last-restore-test
log "Restore test OK ($(cat backups/.last-restore-test))"
