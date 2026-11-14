#!/usr/bin/env bash
# Helper source par backup-db.sh / restore-test.sh : alerte webhook en cas d'echec.
# BACKUP_ALERT_WEBHOOK (.env, facultatif) : URL recevant un POST JSON {"text": "..."}
# (compatible Slack / Discord via /slack / n8n). Absent -> simple avertissement stderr.
#
# Usage : source scripts/notify.sh ; notify_failure "<titre>" "<detail>"
# Ne fait jamais echouer l'appelant (un echec d'alerte ne doit pas masquer l'echec initial).

notify_failure() {
    local title="${1:-Backup failure}" detail="${2:-}"
    local root url host text payload
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    url="$(grep -E '^BACKUP_ALERT_WEBHOOK=' "$root/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
    host="$(hostname 2>/dev/null || echo unknown)"
    text="[disciplina@${host}] ${title}${detail:+ - ${detail}}"

    echo "ALERTE : ${text}" >&2
    if [[ -z "$url" ]]; then
        echo "Avertissement : BACKUP_ALERT_WEBHOOK absent de .env, aucune alerte envoyee" >&2
        return 0
    fi

    # Echappement JSON minimal (backslash, guillemet, retours ligne).
    text="${text//\\/\\\\}"
    text="${text//\"/\\\"}"
    text="${text//$'\n'/ }"
    payload="{\"text\":\"${text}\"}"

    # L'URL contient souvent un secret : lue via --config stdin pour ne pas apparaitre dans ps.
    printf 'url = "%s"\n' "$url" \
        | curl -sS --max-time 10 -X POST -H 'Content-Type: application/json' \
            --data "$payload" --config - >/dev/null \
        || echo "Avertissement : envoi de l'alerte webhook impossible" >&2
    return 0
}
