#!/usr/bin/env bash
# Stop hook: if session touched back/front source (non-test) files, run the
# relevant test/lint suite and block (exit 2) on failure. Non-blocking if the
# test DBs aren't reachable — per HOWTOTEST.md, backend tests need
# docker-compose.test.yml (MySQL on 3307, Mongo on 27017), which isn't
# started automatically here.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CHANGED=$(git status --porcelain --untracked-files=all | awk '{print $2}')

BACK_SRC=$(echo "$CHANGED" | grep -E '^back/src/.*\.ts$' | grep -vE '\.(test|spec)\.ts$' || true)
FRONT_SRC=$(echo "$CHANGED" | grep -E '^front/disciplina-front/src/.*\.(ts|tsx)$' | grep -vE '\.(test|spec)\.(ts|tsx)$' || true)

if [ -z "$BACK_SRC" ] && [ -z "$FRONT_SRC" ]; then
  exit 0
fi

FAIL=0

if [ -n "$BACK_SRC" ]; then
  if nc -z -w1 localhost 3307 2>/dev/null && nc -z -w1 localhost 27017 2>/dev/null; then
    if ! (cd back && MYSQL_PORT=3307 npm test); then
      echo "test-gate: tests backend en échec — corrige avant de terminer." >&2
      FAIL=1
    fi
  else
    echo "test-gate: DBs de test non détectées sur localhost:3307/27017 — tests backend non exécutés. Démarre-les avec: docker compose -f docker-compose.test.yml up -d" >&2
  fi
fi

if [ -n "$FRONT_SRC" ]; then
  if ! (cd front/disciplina-front && npm run lint && npm run build); then
    echo "test-gate: lint/build frontend en échec — corrige avant de terminer." >&2
    FAIL=1
  fi
fi

[ "$FAIL" -eq 1 ] && exit 2
exit 0
