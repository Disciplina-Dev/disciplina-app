#!/usr/bin/env bash
# Stop hook (advisory) : si de la logique métier back/front a changé sans test
# correspondant, le signale sur stderr. Ne bloque pas — seuls les échecs réels
# de tests/lint (test-gate.sh) bloquent.
set -uo pipefail
INPUT="$(cat)"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
. "$ROOT/.claude/hooks/lib.sh"

hook_should_skip && exit 0

CHANGED=$(hook_changed_files)

BACK_SRC=$(echo "$CHANGED" | grep -E '^back/src/(services|graphql|rest|repositories)/.*\.ts$' | grep -vE '\.(test|spec)\.ts$' || true)
BACK_TEST=$(echo "$CHANGED" | grep -E '^back/test/|^back/src/.*/__tests__/.*\.(test|spec)\.ts$' || true)

FRONT_SRC=$(echo "$CHANGED" | grep -E '^front/disciplina-front/src/(features|store)/.*\.(ts|tsx)$' | grep -vE '\.(test|spec)\.(ts|tsx)$' || true)
FRONT_TEST=$(echo "$CHANGED" | grep -E '^front/disciplina-front/e2e/' || true)

MISSING=""
if [ -n "$BACK_SRC" ] && [ -z "$BACK_TEST" ]; then
    MISSING="${MISSING}
Backend (aucun fichier sous back/test/ ou back/src/**/__tests__/ modifié) :
${BACK_SRC}"
fi
if [ -n "$FRONT_SRC" ] && [ -z "$FRONT_TEST" ]; then
    MISSING="${MISSING}
Frontend (aucun test e2e sous front/disciplina-front/e2e/ modifié) :
${FRONT_SRC}"
fi

if [ -n "$MISSING" ]; then
    echo "test-coverage-check (avertissement) : logique métier modifiée sans test correspondant :${MISSING}
Ajoute/mets à jour les tests si pertinent, sinon dis explicitement pourquoi ce n'est pas applicable." >&2
fi
exit 0
