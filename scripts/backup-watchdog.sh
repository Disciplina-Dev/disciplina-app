#!/bin/bash
# Detecte une sauvegarde nocturne manquee (Mac mini en veille a 03:00, job non lance).
# backup-db.sh ecrit backups/.last-backup en cas de succes ; si ce fichier est absent
# ou plus vieux que MAX_AGE_HOURS, alerte webhook (scripts/notify.sh) + exit 1.
# Lance quotidiennement par launchd (scripts/launchd/com.disciplina.backup-watchdog.plist).
set -euo pipefail

MAX_AGE_HOURS=26

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/notify.sh
source "$REPO_ROOT/scripts/notify.sh"

MARKER="backups/.last-backup"

if [[ ! -f "$MARKER" ]]; then
    notify_failure "Backup MISSED" "aucun backup enregistre (${MARKER} absent)"
    exit 1
fi

if [[ -z "$(find "$MARKER" -mmin "-$((MAX_AGE_HOURS * 60))" 2>/dev/null)" ]]; then
    notify_failure "Backup MISSED" "dernier backup reussi > ${MAX_AGE_HOURS}h ($(cat "$MARKER"))"
    exit 1
fi

echo "[$(date -Iseconds)] Backup recent OK ($(cat "$MARKER"))"
