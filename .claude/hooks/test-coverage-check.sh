#!/usr/bin/env bash
# Stop hook: if substantial back/front source logic changed in this session
# without a corresponding test file changing, block (exit 2) and ask Claude
# to add/update tests before finishing. This does not write tests itself —
# it forces Claude to write them in the same turn.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CHANGED=$(git status --porcelain --untracked-files=all | awk '{print $2}')

BACK_SRC=$(echo "$CHANGED" | grep -E '^back/src/(services|graphql|rest|repositories)/.*\.ts$' | grep -vE '\.(test|spec)\.ts$' || true)
BACK_TEST=$(echo "$CHANGED" | grep -E '^back/test/' || true)

FRONT_SRC=$(echo "$CHANGED" | grep -E '^front/disciplina-front/src/(features|store)/.*\.(ts|tsx)$' | grep -vE '\.(test|spec)\.(ts|tsx)$' || true)
FRONT_TEST=$(echo "$CHANGED" | grep -E '^front/disciplina-front/e2e/' || true)

MISSING=""
if [ -n "$BACK_SRC" ] && [ -z "$BACK_TEST" ]; then
  MISSING="${MISSING}
Backend (aucun fichier sous back/test/ modifié) :
${BACK_SRC}"
fi
if [ -n "$FRONT_SRC" ] && [ -z "$FRONT_TEST" ]; then
  MISSING="${MISSING}
Frontend (aucun test e2e sous front/disciplina-front/e2e/ modifié) :
${FRONT_SRC}"
fi

if [ -n "$MISSING" ]; then
  echo "test-coverage-check: logique métier modifiée sans test correspondant :${MISSING}
Ajoute/mets à jour les tests avant de terminer, ou si non applicable, dis-le explicitement à l'utilisateur." >&2
  exit 2
fi
exit 0
