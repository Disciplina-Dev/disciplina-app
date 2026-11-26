#!/usr/bin/env bash
# Stop hook: si la session a touché du source back/front (hors tests), lance la
# suite pertinente et bloque (exit 2) en cas d'échec réel.
# Les tests backend tournent UNIQUEMENT contre docker-compose.test.yml, avec le jeu
# complet de credentials de test (jamais l'env du dev : les tests vident les bases).
# Non bloquant si la stack de test n'est pas joignable.
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

FAIL=0

if [ -n "$BACK_SRC" ]; then
    # JAMAIS la base de dev : les tests vident MySQL (truncateMysql) et Mongo (dropMongo).
    # Une version précédente réutilisait back/.env et a effacé la base de dev locale.
    # On vise uniquement docker-compose.test.yml (3307 / 27018, comptes de test),
    # avec chaque variable de connexion forcée : dotenv ne surcharge jamais une
    # variable déjà posée, donc rien du .env de dev ne peut s'y substituer.
    TEST_MYSQL_P=3307
    TEST_MONGO_P=27018
    if ! nc -z -w1 127.0.0.1 "$TEST_MYSQL_P" 2>/dev/null || ! nc -z -w1 127.0.0.1 "$TEST_MONGO_P" 2>/dev/null; then
        docker compose -f docker-compose.test.yml up -d --wait test-sql-db test-nosql-db >/dev/null 2>&1 || true
    fi
    if nc -z -w1 127.0.0.1 "$TEST_MYSQL_P" 2>/dev/null && nc -z -w1 127.0.0.1 "$TEST_MONGO_P" 2>/dev/null; then
        TEST_API_PORT=4099
        # PDF des analyses de besoin (puppeteer) : sur macOS, Chrome n'est pas dans
        # les chemins Linux connus de PdfService — on le fournit s'il est installé.
        MAC_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ] && [ -x "$MAC_CHROME" ]; then
            export PUPPETEER_EXECUTABLE_PATH="$MAC_CHROME"
        fi
        if ! (
            cd back && env NODE_ENV=test \
                MYSQL_HOST=127.0.0.1 MYSQL_PORT="$TEST_MYSQL_P" MYSQL_DATABASE=disciplina \
                MYSQL_USER=disciplina_app MYSQL_PASSWORD=test-app-password MYSQL_ROOT_PASSWORD=test-root-password \
                MYSQL_URI= MYSQL_ANNEMASSE_URI= \
                MONGO_HOST=127.0.0.1 MONGO_PORT="$TEST_MONGO_P" MONGO_DB_NAME=human_ressources_test \
                MONGO_ROOT_USERNAME=test-root MONGO_ROOT_PASSWORD=test-root-password \
                MONGO_ANNEMASSE_USERNAME=test-root MONGO_ANNEMASSE_PASSWORD=test-root-password \
                MONGO_URI= MONGO_ANNEMASSE_URI= \
                API_PORT="$TEST_API_PORT" MCP_OAUTH_ISSUER_URL="http://localhost:$TEST_API_PORT" \
                MCP_API_KEY=test-mcp-api-key-0123456789abcdef0123456789 \
                npm test
        ); then
            echo "test-gate: tests backend en échec — corrige avant de terminer." >&2
            FAIL=1
        fi
    else
        echo "test-gate: stack de test injoignable (127.0.0.1:${TEST_MYSQL_P} / 127.0.0.1:${TEST_MONGO_P}) — tests backend non exécutés. Démarre-la avec: docker compose -f docker-compose.test.yml up -d test-sql-db test-nosql-db" >&2
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
