#!/usr/bin/env bash
# Roll back the last production deploy, mirroring HOWTODEPLOY.md section 5.
# Restores the pre-deploy database dumps recorded by scripts/deploy.sh
# (scripts/.deploy-state) and reverts the code to the previous HEAD.
#
# Usage:
#   ./scripts/rollback.sh                # restaure + revient sur PREV_HEAD
#   ./scripts/rollback.sh --ref <commit> # revient sur <commit> au lieu de PREV_HEAD
#   ./scripts/rollback.sh --dry-run      # affiche le plan sans rien exécuter
#   ./scripts/rollback.sh --force        # passe outre l'arbre de travail non propre
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STATE_FILE="scripts/.deploy-state"
COMPOSE_PROD=(docker compose -f docker-compose.yaml -f docker-compose.prod.yaml)
READY_TIMEOUT=180

DRY=0
FORCE=0
TARGET_REF=""

log()     { printf '%s\n' "$*"; }
warn()    { printf '⚠  %s\n' "$*" >&2; }
die()     { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }
confirm() {
    local ans
    printf '%s [y/N] > ' "$1"
    read -r ans || return 1
    [[ "${ans,,}" =~ ^(y|yes|o|oui)$ ]]
}
run() {
    if (( DRY )); then
        printf '  $ %s\n' "$*"
        return 0
    fi
    "$@"
}

while (($# > 0)); do
    case "$1" in
        --dry-run) DRY=1 ;;
        --force)   FORCE=1 ;;
        --ref)     TARGET_REF="${2:?--ref requiert un commit}"; shift ;;
        -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) die "option inconnue : $1" ;;
    esac
    shift
done

# .env contient des valeurs avec métacaractères shell : extraction ciblée.
load_env() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2-
}

curl_sc() {
    curl -s --max-time 3 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true
}
wait_http() {
    local url="$1" name="$2" code i
    log "  attente readiness ${name} (${url}) ..."
    for ((i = 0; i < READY_TIMEOUT; i += 5)); do
        code="$(curl_sc "$url" || true)"
        if ((code >= 200 && code < 500)); then
            log "  OK ${name} répond (HTTP ${code})"
            return 0
        fi
        sleep 5
    done
    warn "${name} pas prêt après ${READY_TIMEOUT}s (dernier code HTTP ${code})"
    return 1
}

section() { printf '\n=== %s ===\n' "$*"; }

# --------------------------------------------------------- 1. cible de revert
section "1/6 Référence de rollback"
PREV_HEAD=""
MYSQL_DUMP=""
MONGO_DUMP=""
if [[ -n "$TARGET_REF" ]]; then
    REF="$TARGET_REF"
    log "  --ref fourni : ${REF}"
elif [[ -f "$STATE_FILE" ]]; then
    # shell-safe : lignes VAR=... écrites par deploy.sh
    # shellcheck source=/dev/null
    source "$STATE_FILE"
    REF="${PREV_HEAD:?état dégradé : PREV_HEAD absent de $STATE_FILE}"
    log "  réf depuis ${STATE_FILE} (PREV_HEAD) : ${REF}"
else
    die "pas de ${STATE_FILE} ni de --ref — indiquer le commit à restaurer (--ref <commit>)."
fi
git rev-parse --verify --quiet "$REF" >/dev/null || die "référence invalide : $REF"
[[ -n "$MYSQL_DUMP" && -f "$MYSQL_DUMP" ]] || MYSQL_DUMP=""
[[ -n "$MONGO_DUMP" && -f "$MONGO_DUMP" ]] || MONGO_DUMP=""
if [[ -z "$MYSQL_DUMP" && -z "$MONGO_DUMP" ]]; then
    warn "aucun dump retrouvé (état : réf=${REF}, mysql='${MYSQL_DUMP}', mongo='${MONGO_DUMP}')"
    confirm "Continuer quand même (restauration DB ignorée) ?" || die "annulé"
fi

# ------------------------------------------------------- 2. contrôles git/env
section "2/6 Contrôles"
if git diff --quiet && git diff --cached --quiet; then
    log "  arbre de travail propre"
elif (( FORCE )); then
    warn "arbre de travail non propre mais --force"
else
    die "arbre de travail non propre (committer/stasher d'abord). --force pour passer outre."
fi
if (( ! DRY )); then
    [[ -n "$(docker compose ps -q sql-db nosql-db 2>/dev/null)" ]] \
        || die "sql-db / nosql-db doivent être up : docker compose up -d sql-db nosql-db"
fi

log "  Restauration des bases depuis :"
[[ -n "$MYSQL_DUMP" ]] && log "    MySQL   → $MYSQL_DUMP ($(du -h "$MYSQL_DUMP" | cut -f1))"
[[ -n "$MONGO_DUMP" ]] && log "    MongoDB → $MONGO_DUMP ($(du -h "$MONGO_DUMP" | cut -f1))"
log "  Code : retour sur $REF"
confirm "Exécuter ce rollback (DESTRUCTIF pour le contenu actuel des bases) ?" || die "annulé"

# ---------------------------------------------------------- 3. restaurer DB
section "3/6 Restauration des bases de données"
MYSQL_ROOT_PASSWORD="$(load_env MYSQL_ROOT_PASSWORD)"
MONGO_ROOT_USERNAME="$(load_env MONGO_ROOT_USERNAME)"
MONGO_ROOT_PASSWORD="$(load_env MONGO_ROOT_PASSWORD)"

run docker compose stop backend

if [[ -n "$MYSQL_DUMP" ]]; then
    log "  restauration MySQL ($MYSQL_DUMP) ..."
    if (( DRY )); then
        log "  $ docker compose exec -T -e MYSQL_PWD=*** sql-db mysql -h127.0.0.1 -uroot disciplina < $MYSQL_DUMP"
    else
        docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" sql-db \
            mysql -h127.0.0.1 -uroot disciplina < "$MYSQL_DUMP"
    fi
    log "  OK MySQL restauré"
else
    warn "pas de dump MySQL : ignore"
fi

if [[ -n "$MONGO_DUMP" ]]; then
    log "  restauration MongoDB ($MONGO_DUMP) ..."
    gzip_opt=()
    if gzip -t "$MONGO_DUMP" 2>/dev/null; then gzip_opt=(--gzip); fi
    if (( DRY )); then
        log "  $ docker compose exec -T nosql-db mongorestore --archive${gzip_opt[0]:+ --gzip} --drop --db human_ressources < $MONGO_DUMP"
    else
        docker compose exec -T -e MONGO_ROOT_USERNAME -e MONGO_ROOT_PASSWORD nosql-db \
            mongorestore --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
            --authenticationDatabase admin --archive "${gzip_opt[@]}" --drop --db human_ressources < "$MONGO_DUMP"
    fi
    log "  OK MongoDB restauré"
else
    warn "pas de dump MongoDB : ignore"
fi

section "4/6 Redémarrage du backend (base restaurée)"
run docker compose start backend

# --------------------------------------------------------- 5. revert du code
section "5/6 Revert du code sur ${REF}"
run git checkout "$REF"
run "${COMPOSE_PROD[@]}" build
run "${COMPOSE_PROD[@]}" up -d
if (( ! DRY )); then
    wait_http "http://127.0.0.1:8090" "frontend"
    wait_http "http://127.0.0.1:4000/graphql" "backend"
fi

# ------------------------------------------------------------- 6. rapport
section "6/6 Résumé du rollback"
log "  HEAD actuel : $(git rev-parse HEAD 2>/dev/null || echo N/A)"
log "  Bases restaurées : MySQL=$([[ -n "$MYSQL_DUMP" ]] && echo oui || echo non) MongoDB=$([[ -n "$MONGO_DUMP" ]] && echo oui || echo non)"
log "  Les dumps restent dans backups/ pour archive."
exit 0