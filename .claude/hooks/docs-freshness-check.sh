#!/usr/bin/env bash
# Stop hook: if a change touches something a living doc describes (DB schema,
# npm scripts, test helpers, new layer/module pattern) without that doc being
# touched in the same session, block (exit 2) and point at the section to
# review. Docs watched: CLAUDE.md, back/CONVENTION.md, back/HOWTOTEST.md.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CHANGED=$(git status --porcelain --untracked-files=all | awk '{print $2}')

DOCS_TOUCHED=$(echo "$CHANGED" | grep -E '^(CLAUDE\.md|back/CONVENTION\.md|back/HOWTOTEST\.md)$' || true)

REMINDERS=""

SCHEMA=$(echo "$CHANGED" | grep -E '^(database/mysql/mysql-init\.sql|back/src/db/mysql/migrations\.ts)$' || true)
if [ -n "$SCHEMA" ] && [ -z "$DOCS_TOUCHED" ]; then
  REMINDERS="${REMINDERS}
- Schéma MySQL modifié (${SCHEMA}) sans CONVENTION.md/CLAUDE.md touché — vérifie la section 'Database conventions' / la règle des deux endroits."
fi

SCRIPTS=$(echo "$CHANGED" | grep -E '^back/package\.json$' || true)
if [ -n "$SCRIPTS" ] && [ -z "$DOCS_TOUCHED" ]; then
  REMINDERS="${REMINDERS}
- back/package.json modifié sans CLAUDE.md touché — vérifie la section 'Commands' (back/)."
fi

TESTSETUP=$(echo "$CHANGED" | grep -E '^back/(test/helpers/|vitest\.config\.ts)' || true)
if [ -n "$TESTSETUP" ] && [ -z "$DOCS_TOUCHED" ]; then
  REMINDERS="${REMINDERS}
- Setup de tests modifié (${TESTSETUP}) sans HOWTOTEST.md touché."
fi

NEWLAYER=$(echo "$CHANGED" | grep -E '^back/src/(rest|graphql|services|repositories)/[^/]+/' | grep -v '\.ts$' || true)
if [ -z "$NEWLAYER" ]; then
  NEWLAYER=$(git status --porcelain --untracked-files=all | awk '$1 == "??" {print $2}' | grep -E '^back/src/(rest|graphql|services|repositories)/' || true)
fi
if [ -n "$NEWLAYER" ] && [ -z "$DOCS_TOUCHED" ]; then
  REMINDERS="${REMINDERS}
- Nouveau fichier de couche back (${NEWLAYER}) sans CONVENTION.md touché — vérifie qu'il suit les conventions de la couche et la table 'Convention violations'."
fi

if [ -n "$REMINDERS" ]; then
  echo "docs-freshness-check: des docs vivants pourraient être obsolètes :${REMINDERS}
Mets-les à jour si pertinent, ou confirme explicitement que rien ne change." >&2
  exit 2
fi
exit 0
