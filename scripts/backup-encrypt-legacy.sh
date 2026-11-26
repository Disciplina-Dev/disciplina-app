#!/usr/bin/env bash
# Migration ponctuelle (GDPR_INF_01.2) : chiffre avec age les dumps encore en clair
# laissés par les anciennes versions de backup-db.sh / backup.sh, puis supprime
# les originaux en clair.
#
# Périmètre : backups/*.sql|*.archive et scripts/backups/**/*.sql|*.archive|*.json
# (les .json sont les copies de suppression de delete_companies.py).
#
# Usage :
#   ./scripts/backup-encrypt-legacy.sh            # dry run : liste ce qui serait chiffré
#   ./scripts/backup-encrypt-legacy.sh --execute  # chiffre puis supprime les clairs
#
# Nécessite age + BACKUP_AGE_RECIPIENT dans .env (clé publique uniquement).
# Idempotent : les fichiers .age sont ignorés. Un clair n'est supprimé qu'après
# vérification que le fichier chiffré existe, est non vide et a un en-tête age.
set -euo pipefail
umask 077

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXECUTE=0
case "${1:-}" in
    --execute) EXECUTE=1 ;;
    "") ;;
    -h | --help) sed -n '2,15p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
esac

RECIPIENT="$(grep -E '^BACKUP_AGE_RECIPIENT=' .env | tail -1 | cut -d= -f2- || true)"
command -v age >/dev/null 2>&1 || { echo "Erreur : 'age' introuvable dans le PATH" >&2; exit 1; }
[[ "$RECIPIENT" =~ ^age1[a-z0-9]+$ ]] || { echo "Erreur : BACKUP_AGE_RECIPIENT absent ou invalide dans .env" >&2; exit 1; }

FILES=()
while IFS= read -r -d '' f; do FILES+=("$f"); done < <(
    { [[ -d backups ]] && find backups -maxdepth 1 -type f \( -name '*.sql' -o -name '*.archive' \) -print0
      [[ -d scripts/backups ]] && find scripts/backups -type f \( -name '*.sql' -o -name '*.archive' -o -name '*.json' \) -print0
    } || true
)

if ((${#FILES[@]} == 0)); then
    echo "Aucun dump en clair trouvé."
    exit 0
fi

secure_rm() {
    if command -v shred >/dev/null 2>&1; then shred -u -- "$1"; else rm -f -- "$1"; fi
}

for f in "${FILES[@]}"; do
    if ((! EXECUTE)); then
        echo "[dry-run] $f ($(du -h "$f" | cut -f1)) -> $f.age"
        continue
    fi
    age -r "$RECIPIENT" -o "$f.age.part" -- "$f"
    mv "$f.age.part" "$f.age"
    if [[ ! -s "$f.age" ]] || [[ "$(head -c 21 "$f.age")" != "age-encryption.org/v1" ]]; then
        echo "Erreur : $f.age invalide, original conservé." >&2
        exit 1
    fi
    secure_rm "$f"
    echo "chiffré : $f -> $f.age"
done

if ((EXECUTE)); then
    echo
    echo "Terminé : ${#FILES[@]} fichier(s) chiffré(s), clairs supprimés."
    echo "Notes :"
    echo "  - shred/rm n'efface pas de façon fiable sur SSD/APFS : chiffrement disque (FileVault) recommandé."
    echo "  - scripts/.deploy-state peut référencer d'anciens dumps en clair (rollback.sh les signalera absents)."
else
    echo
    echo "Dry run : ${#FILES[@]} fichier(s). Relancer avec --execute pour chiffrer et supprimer les clairs."
fi
