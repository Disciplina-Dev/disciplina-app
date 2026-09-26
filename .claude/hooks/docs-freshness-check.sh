#!/usr/bin/env bash
# Stop hook (advisory) : si un changement touche ce qu'un doc vivant décrit
# (schéma DB, scripts npm, setup de tests, nouveau fichier de couche) sans que
# ce doc soit touché, le signale sur stderr. Ne bloque pas.
# Docs surveillés : CLAUDE.md, back/CONVENTION.md, back/HOWTOTEST.md.
set -uo pipefail
INPUT="$(cat)"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
. "$ROOT/.claude/hooks/lib.sh"

hook_should_skip && exit 0

CHANGED=$(hook_changed_files)

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

# Fichiers de couche back nouvellement créés (non suivis par git).
NEWLAYER=$(git status --porcelain -z --untracked-files=all |
    tr '\0' '\n' | grep -E '^\?\? back/src/(rest|graphql|services|repositories)/' | cut -c4- || true)
if [ -n "$NEWLAYER" ] && [ -z "$DOCS_TOUCHED" ]; then
    REMINDERS="${REMINDERS}
- Nouveau fichier de couche back (${NEWLAYER}) sans CONVENTION.md touché — vérifie qu'il suit les conventions de la couche et la table 'Convention violations'."
fi

if [ -n "$REMINDERS" ]; then
    echo "docs-freshness-check (avertissement) : des docs vivants pourraient être obsolètes :${REMINDERS}
Mets-les à jour si pertinent, ou confirme explicitement que rien ne change." >&2
fi
exit 0
