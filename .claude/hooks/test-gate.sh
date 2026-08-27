#!/usr/bin/env bash
# Stop hook: si la session a touché du source back/front (hors tests), lance la
# suite pertinente et bloque (exit 2) en cas d'échec réel.
# Les tests backend tournent avec l'env du dev (back/.env) — surtout pas d'override
# de MYSQL_PORT : le 3307 de docker-compose.test.yml va de pair avec tout un jeu de
# credentials de test, le forcer seul fait échouer 100% des tests.
# Non bloquant si la DB configurée n'est pas joignable.
set -uo pipefail
INPUT="$(cat)"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
. "$ROOT/.claude/hooks/lib.sh"

hook_should_skip && exit 0

CHANGED=$(hook_changed_files)

BACK_SRC=$(echo "$CHANGED" | grep -E '^back/src/.*\.ts$' | grep -vE '\.(test|spec)\.ts$' || true)
FRONT_SRC=$(echo "$CHANGED" | grep -E '^front/disciplina-front/src/.*\.(ts|tsx)$' | grep -vE '\.(test|spec)\.(ts|tsx)$' || true)

if [ -z "$BACK_SRC" ] && [ -z "$FRONT_SRC" ]; then
    exit 0
fi

# Lit une clé dans l'env courant, sinon back/.env, sinon .env racine, sinon défaut.
env_value() {
    local key="$1" fallback="$2" raw
    raw="${!key:-}"
    if [ -z "$raw" ] && [ -f back/.env ]; then
        raw=$(grep -E "^${key}=" back/.env | tail -1 | cut -d= -f2- || true)
    fi
    if [ -z "$raw" ] && [ -f .env ]; then
        raw=$(grep -E "^${key}=" .env | tail -1 | cut -d= -f2- || true)
    fi
    printf '%s' "${raw:-$fallback}"
}

FAIL=0

if [ -n "$BACK_SRC" ]; then
    MYSQL_H=$(env_value MYSQL_HOST 127.0.0.1)
    MYSQL_P=$(env_value MYSQL_PORT 3306)
    MONGO_H=$(env_value MONGO_HOST 127.0.0.1)
    MONGO_P=$(env_value MONGO_PORT 27017)
    # Hôtes internes au réseau compose : injoignables depuis l'hôte, on teste en local.
    case "$MYSQL_H" in sql-db | nosql-db) MYSQL_H=127.0.0.1 ;; esac
    case "$MONGO_H" in sql-db | nosql-db) MONGO_H=127.0.0.1 ;; esac

    if nc -z -w1 "$MYSQL_H" "$MYSQL_P" 2>/dev/null && nc -z -w1 "$MONGO_H" "$MONGO_P" 2>/dev/null; then
        if ! (cd back && npm test); then
            echo "test-gate: tests backend en échec — corrige avant de terminer." >&2
            FAIL=1
        fi
    else
        echo "test-gate: DBs non joignables (${MYSQL_H}:${MYSQL_P} / ${MONGO_H}:${MONGO_P}) — tests backend non exécutés. Démarre-les avec: docker compose up -d sql-db nosql-db" >&2
    fi
fi

if [ -n "$FRONT_SRC" ]; then
    # Lint : advisory. Le dépôt a une dette lint préexistante (76 erreurs sur
    # branche propre) — bloquer dessus rendrait le gate impossible à satisfaire.
    if ! (cd front/disciplina-front && npm run lint); then
        echo "test-gate (avertissement) : lint frontend en échec — vérifie que tes fichiers ne sont pas en cause (dette lint préexistante côté dépôt)." >&2
    fi
    if ! (cd front/disciplina-front && npm run build); then
        echo "test-gate: build frontend en échec — corrige avant de terminer." >&2
        FAIL=1
    fi
fi

[ "$FAIL" -eq 1 ] && exit 2
exit 0
