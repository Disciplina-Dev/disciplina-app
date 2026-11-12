#!/usr/bin/env bash
# Génère la paire de clés age pour le chiffrement des sauvegardes (GDPR_INF_01.2).
# À lancer sur le poste d'un administrateur, PAS sur le Mac mini de production.
#
# Usage :
#   ./scripts/backup-keygen.sh <fichier-identity>
#   ex. ./scripts/backup-keygen.sh ~/disciplina-backup-identity.txt
#
# - <fichier-identity> reçoit la clé PRIVÉE (à restaurer uniquement). Refus si le
#   fichier existe déjà ou s'il se trouve dans le dépôt.
# - La clé PUBLIQUE (age1…) est affichée : c'est la seule valeur à mettre dans
#   BACKUP_AGE_RECIPIENT du .env de production.
# Voir « Backup encryption » dans HOWTODEPLOY.md pour la garde de la clé privée.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OUT="${1:-}"
if [[ -z "$OUT" || "$OUT" == "-h" || "$OUT" == "--help" ]]; then
    sed -n '2,12p' "${BASH_SOURCE[0]}"
    exit 0
fi

command -v age-keygen >/dev/null 2>&1 || { echo "Erreur : 'age-keygen' introuvable (brew/dnf install age)" >&2; exit 1; }
[[ ! -e "$OUT" ]] || { echo "Erreur : $OUT existe déjà (pas d'écrasement)." >&2; exit 1; }

OUT_DIR="$(cd "$(dirname "$OUT")" 2>/dev/null && pwd)" \
    || { echo "Erreur : le dossier de $OUT n'existe pas." >&2; exit 1; }
OUT_ABS="$OUT_DIR/$(basename "$OUT")"
case "$OUT_ABS/" in
    "$REPO_ROOT"/*)
        echo "Erreur : la clé privée ne doit jamais être dans le dépôt ($REPO_ROOT)." >&2
        exit 1
        ;;
esac

umask 077
age-keygen -o "$OUT_ABS" 2>/dev/null
RECIPIENT="$(grep -E '^# public key: ' "$OUT_ABS" | cut -d' ' -f4)"
[[ "$RECIPIENT" =~ ^age1[a-z0-9]+$ ]] || { echo "Erreur : clé publique introuvable dans $OUT_ABS" >&2; exit 1; }

cat <<MSG
Clé privée : $OUT_ABS  (permissions 600)
Clé publique (à mettre dans le .env de production) :

  BACKUP_AGE_RECIPIENT=$RECIPIENT

À faire maintenant :
  1. Copier la clé privée dans le gestionnaire de mots de passe partagé (>= 2 personnes).
  2. Idéalement, en garder une copie papier/hors ligne dans un coffre.
  3. Supprimer $OUT_ABS de ce poste une fois les copies vérifiées.
  4. NE JAMAIS la placer sur le Mac mini, dans le dépôt, dans .env ou dans backups/.
MSG
