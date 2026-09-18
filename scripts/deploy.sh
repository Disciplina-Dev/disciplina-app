#!/usr/bin/env bash
# Deployment automation for the production server, mirroring HOWTODEPLOY.md
# (sections 1-5). Everything scriptable is automated; the "Notes for special
# features" section (multi-tenant env vars, MCP key, MySQL columns...) stays
# manual and is intentionally NOT touched here.
#
# Usage:
#   ./scripts/deploy.sh                  # full deploy (with confirmations)
#   ./scripts/deploy.sh --dry-run        # print the plan, execute nothing
#   ./scripts/deploy.sh --skip-tests     # skip the post-deploy test suite
#   ./scripts/deploy.sh --skip-backup    # skip the mandatory backup (DANGEROUS)
#   ./scripts/deploy.sh --force          # bypass branch / clean-tree / main-merged guards
#
# Rollback: ./scripts/rollback.sh (restores the dumps + reverts the code).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_PROD=(docker compose -f docker-compose.yaml -f docker-compose.prod.yaml)
COMPOSE_TEST=(docker compose -f docker-compose.test.yml)
TEST_CMD=("${COMPOSE_TEST[@]}" up --build --force-recreate --abort-on-container-exit --exit-code-from test-backend)
STATE_FILE="scripts/.deploy-state"
BACKUP_DIR="backups"
FRONTEND_URL="http://127.0.0.1:8090"
BACKEND_URL="http://127.0.0.1:4000"
MCP_URL="${BACKEND_URL}/api/mcp"
READY_TIMEOUT=180
SMOKE_BASE="Smoke tests in your browser (public URL via Caddy), then confirm"

DRY=0
SKIP_TESTS=0
SKIP_BACKUP=0
FORCE=0

log()     { printf '%s\n' "$*"; }
warn()    { printf '⚠  %s\n' "$*" >&2; }
die()     { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }
section() { printf '\n=== %s ===\n' "$*"; }

confirm() {
    # $1 = prompt ; returns 0 on y/yes/o/oui
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

usage() {
    sed -n '2,14p' "${BASH_SOURCE[0]}"
    exit 0
}

while (($# > 0)); do
    case "$1" in
        --dry-run)    DRY=1 ;;
        --skip-tests) SKIP_TESTS=1 ;;
        --skip-backup) SKIP_BACKUP=1 ;;
        --force)      FORCE=1 ;;
        -h|--help)    usage ;;
        *) die "option inconnue : $1" ;;
    esac
    shift
done

# .env contient des valeurs avec métacaractères shell (ex. `&` dans MONGO_URI),
# donc `source .env` échoue en parse error. On n'extrait que les clés nécessaires.
load_env() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2-
}

curl_sc() {
    curl -s --max-time 3 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true
}

wait_http() {
    # $1 url, $2 nom du service ; attend un code HTTP utile (2xx-4xx, pas 000/5xx)
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

# ---------------------------------------------------------------- 1. preflight
section "1/7 Pre-flight"
command -v docker >/dev/null 2>&1 || die "docker absent"
command -v git >/dev/null 2>&1 || die "git absent"
[[ -f docker-compose.yaml ]]  || die "docker-compose.yaml introuvable"
[[ -f docker-compose.prod.yaml ]] || die "docker-compose.prod.yaml introuvable"
[[ -f .env ]] || die ".env introuvable à la racine du repo"
if (( ! DRY )); then
    [[ -n "$(docker compose ps -q sql-db nosql-db 2>/dev/null)" ]] \
        || die "sql-db / nosql-db doivent être up : docker compose up -d sql-db nosql-db"
fi
log "  pré-requis OK"

# ------------------------------------------------------------------ 2. git
section "2/7 Vérifications git et synchronisation prod"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "prod" ]]; then
    if (( FORCE )); then
        warn "branche courante '$BRANCH' != prod mais --force"
    else
        die "il faut être sur la branche 'prod' (courante : '$BRANCH'). --force pour passer outre."
    fi
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
    if (( FORCE )); then
        warn "arbre de travail non propre mais --force"
    else
        die "arbre de travail non propre (committer/stasher d'abord). --force pour passer outre."
    fi
fi
PREV_HEAD="$(git rev-parse HEAD)"
log "  HEAD avant déploiement : ${PREV_HEAD:0:12}"
run git fetch origin
if ! git merge-base --is-ancestor origin/main origin/prod 2>/dev/null; then
    if (( FORCE )); then
        warn "origin/main n'est pas entièrement fusionné dans origin/prod mais --force"
    else
        die "origin/main n'est pas entièrement fusionné dans origin/prod (fusionner d'abord). --force pour passer outre."
    fi
else
    log "  origin/main bien ancêtre d'origin/prod"
fi
if ! git diff --quiet HEAD origin/prod; then
    log "  pull ff-only de origin prod :"
    run git pull --ff-only origin prod
else
    log "  déjà synchronisé avec origin/prod"
fi

# ------------------------------------------------------ 3. pre-deploy checks
section "3/7 Pre-deploy checks (changelog)"
VER_RE='^## \[[0-9]+\.[0-9]+\.[0-9]+\]'
CHANGELOG_VER="$(grep -m1 -E "$VER_RE" CHANGELOG.md || true)"
FRONT_CHANGELOG="front/disciplina-front/src/content/CHANGELOG.md"
FRONT_VER="$(grep -m1 -E "$VER_RE" "$FRONT_CHANGELOG" 2>/dev/null || true)"
if [[ -z "$CHANGELOG_VER" ]]; then
    warn "CHANGELOG.md : aucune entrée versionnée '## [x.y.z]' détectée"
else
    log "  CHANGELOG.md : ${CHANGELOG_VER}"
fi
if [[ -z "$FRONT_VER" ]]; then
    warn "${FRONT_CHANGELOG} : aucune entrée versionnée détectée"
elif [[ "$CHANGELOG_VER" != "$FRONT_VER" ]]; then
    warn "changelog front décalé : ${FRONT_VER} (root ${CHANGELOG_VER})"
else
    log "  changelog front synchronisé : ${FRONT_VER}"
fi
if ! confirm "PRs et bump de version faits ? Vérification du changelog ci-dessus OK ?"; then
    die "annulé par l'utilisateur (pre-deploy checks)"
fi

# ------------------------------------------------------------- 4. backup
section "4/7 Sauvegarde base de données (obligatoire)"
if (( SKIP_BACKUP )); then
    warn "――――――――――――――――――――――――――――――――――――――――――――――――――"
    warn "  --skip-backup détecté : AUCUNE sauvegarde ne sera faite."
    warn "  Rollback impossible. Continue uniquement si tu sais pourquoi."
    warn "――――――――――――――――――――――――――――――――――――――――――――――――――"
    confirm "Vraiment continuer SANS sauvegarde ?" || die "annulé (backup requis)"
else
    run ./scripts/backup-db.sh
    MYSQL_DUMP="$(ls -t ${BACKUP_DIR}/backup_mysql_*.sql       2>/dev/null | head -1 || true)"
    MONGO_DUMP="$(ls -t ${BACKUP_DIR}/backup_mongo_*.archive  2>/dev/null | head -1 || true)"
    [[ -n "$MYSQL_DUMP" && -s "$MYSQL_DUMP" ]] || die "dump MySQL récent introuvable/vide dans ${BACKUP_DIR}/"
    [[ -n "$MONGO_DUMP" && -s "$MONGO_DUMP" ]] || die "dump MongoDB récent introuvable/vide dans ${BACKUP_DIR}/"
    log "  MySQL   → ${MYSQL_DUMP} ($(du -h "$MYSQL_DUMP" | cut -f1))"
    log "  MongoDB → ${MONGO_DUMP} ($(du -h "$MONGO_DUMP" | cut -f1))"
    if (( ! DRY )); then
        cat > "$STATE_FILE" <<EOF
PREV_HEAD=$PREV_HEAD
MYSQL_DUMP=$MYSQL_DUMP
MONGO_DUMP=$MONGO_DUMP
DEPLOYED_AT=$(date -Iseconds)
EOF
        log "  état enregistré : $STATE_FILE"
    fi
fi

# ------------------------------------------------------------ 5. build & up
section "5/7 Build et démarrage des images de production"
run "${COMPOSE_PROD[@]}" build
run "${COMPOSE_PROD[@]}" up -d
if (( ! DRY )); then
    wait_http "$FRONTEND_URL" "frontend"
    wait_http "${BACKEND_URL}/graphql" "backend"
    "${COMPOSE_PROD[@]}" ps
fi

# ------------------------------------------- 6. post-deploy verification
section "6/7 Vérification post-déploiement"
TEST_RESULT="N/A"
if (( SKIP_TESTS )); then
    warn "--skip-tests : suite de tests isolée non exécutée"
else
    log "  suite de tests isolée (docker-compose.test.yml)..."
    if (( DRY )); then
        log "  $ ${TEST_CMD[*]}"
    elif "${TEST_CMD[@]}"; then
        TEST_RESULT="PASS"
        log "  tests : PASS"
    else
        TEST_RESULT="FAIL"
        warn "tests : FAIL"
    fi
    # le stack de test n'a pas lieu de rester up
    run "${COMPOSE_TEST[@]}" down
fi

log "  smoke checks HTTP :"
FRONT_CODE="$(curl_sc "$FRONTEND_URL" || true)"
BACKEND_CODE="$(curl_sc "${BACKEND_URL}/graphql" || true)"
MCP_CODE="$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' -d '{}' "$MCP_URL" 2>/dev/null || true)"
log "    frontend      ${FRONTEND_URL}           → HTTP ${FRONT_CODE}"
log "    backend       /graphql                  → HTTP ${BACKEND_CODE}"
log "    mcp           POST ${MCP_URL} → HTTP ${MCP_CODE} (valeur != 401 attendue)"
if (( ! DRY )); then
    if (( FRONT_CODE >= 500 || FRONT_CODE == 000 )); then warn "frontend semble HS (${FRONT_CODE})"; fi
    if (( BACKEND_CODE >= 500 || BACKEND_CODE == 000 )); then warn "backend semble HS (${BACKEND_CODE})"; fi
    if (( MCP_CODE == 401 || MCP_CODE == 000 )); then warn "MCP renvoie 401 : vérifier MCP_API_KEY (≥32 chars)"; fi

    ERRORS="$(docker compose logs --tail 200 backend 2>/dev/null | grep -iE '\b(ERROR|EXCEPTION)\b' || true)"
    if [[ -n "$ERRORS" ]]; then
        warn "erreurs/exception dans les 200 dernières lignes de log backend :"
        printf '%s\n' "$ERRORS" | tail -5 | sed 's/^/    /'
    else
        log "  log backend : aucune erreur détectée sur les 200 dernières lignes"
    fi

    log "  $SMOKE_BASE :"
    smoke_ok=0
    smoke_total=0
    for item in \
        "Le frontend se charge à l'URL publique" \
        "Connexion fonctionne (tenant RÉUNION)" \
        "Connexion fonctionne (tenant ANNEMASSE)" \
        "Création d'un candidat" \
        "Création d'une offre / analyse de besoin" \
        "Page matching se charge" \
        "POST /api/mcp répond sans 401" ; do
        smoke_total=$((smoke_total + 1))
        if confirm "  Smoke : ${item}"; then
            smoke_ok=$((smoke_ok + 1))
        else
            warn "  NON CONFIRMÉ : ${item}"
        fi
    done
fi

# ------------------------------------------------------------- 7. report
section "7/7 Résumé du déploiement"
log "  HEAD déployé      : $(git rev-parse HEAD 2>/dev/null || echo N/A)"
log "  HEAD précédent    : ${PREV_HEAD}"
if [[ "$SKIP_BACKUP" == "0" ]]; then
    log "  Backups           : ${MYSQL_DUMP} | ${MONGO_DUMP}"
else
    log "  Backups           : PASSÉES (--skip-backup)"
fi
log "  Tests post-deploy  : ${TEST_RESULT}"
log "  Smoke HTTP         : front=${FRONT_CODE} backend=${BACKEND_CODE} mcp=${MCP_CODE}"
log "  Rollback           : ./scripts/rollback.sh"
log ""
log "Rappel — manuel (non scripté) : consulter HOWTODEPLOY.md §6 (notes)"
exit 0