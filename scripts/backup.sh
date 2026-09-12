#!/usr/bin/env bash
# Sauvegarde / restauration interactives de la stack dev (MySQL + MongoDB)
# dans scripts/backups/<label>/ — convention : <db>-<label>.sql | .archive.
#
# Usage :
#   ./scripts/backup.sh                  # menu interactif
#   ./scripts/backup.sh backup [label]   # sauvegarde directe
#   ./scripts/backup.sh restore [label]  # restaure (defaut : latest)
#   ./scripts/backup.sh list             # liste les sauvegardes
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
BACKUP_ROOT="scripts/backups"

# .env contient des valeurs avec metacaracteres shell : on n'extrait que les cles
# necessaires (meme approche que scripts/backup-db.sh).
load_env() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2-
}
MYSQL_ROOT_PASSWORD="$(load_env MYSQL_ROOT_PASSWORD)"
MONGO_ROOT_USERNAME="$(load_env MONGO_ROOT_USERNAME)"
MONGO_ROOT_PASSWORD="$(load_env MONGO_ROOT_PASSWORD)"

savedir() { printf '%s' "$BACKUP_ROOT/$1"; }
is_running() {
    [[ -n "$(docker compose ps -q sql-db nosql-db 2>/dev/null)" ]]
}
check_env() {
    if [[ -z "$MYSQL_ROOT_PASSWORD" || -z "$MONGO_ROOT_USERNAME" || -z "$MONGO_ROOT_PASSWORD" ]]; then
        echo "Erreur : MYSQL_ROOT_PASSWORD / MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD manquants dans .env" >&2
        exit 1
    fi
    if ! is_running; then
        echo "Erreur : stack dev non demarree (docker compose up -d sql-db nosql-db)" >&2
        exit 1
    fi
}

list_backups() {
    local labels=() d
    mkdir -p "$BACKUP_ROOT"
    for d in "$BACKUP_ROOT"/*/; do
        [[ -d "$d" ]] || continue
        labels+=("$(basename "$d")")
    done
    if ((${#labels[@]} == 0)); then
        echo "Aucune sauvegarde dans $BACKUP_ROOT/"
        return 0
    fi
    local latest
    latest="$(readlink "$BACKUP_ROOT/latest" 2>/dev/null || echo '-')"
    echo "Sauvegardes dans $BACKUP_ROOT/ :"
    for label in "${labels[@]}"; do
        local size
        size="$(du -sh "$(savedir "$label")" 2>/dev/null | cut -f1 || true)"
        echo "  $label  ($size)  $([ "$label" = "$latest" ] && echo '<-- latest')"
        ls -1 "$(savedir "$label")/" | sed 's/^/      /'
    done
}

do_backup() {
    local label="$1"
    local dest
    dest="$(savedir "$label")"
    mkdir -p "$dest"
    local mysql_file="$dest/disciplina-$label.sql"
    local mongo_file="$dest/human_ressources-$label.archive"
    if [[ -f "$mysql_file" || -f "$mongo_file" ]]; then
        echo "Erreur : une sauvegarde '$label' existe deja." >&2
        exit 1
    fi

    echo "[1/2] MySQL (disciplina.companies, candidates... en MySQL) ..."
    docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" sql-db \
        mysqldump -h127.0.0.1 -uroot --single-transaction --routines --triggers \
        disciplina > "$mysql_file"

    echo "[2/2] MongoDB (human_ressources.candidates, offers...) ..."
    docker compose exec -T -e MONGO_ROOT_USERNAME -e MONGO_ROOT_PASSWORD nosql-db \
        mongodump --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin --db human_ressources --archive > "$mongo_file"

    if [[ -L "$BACKUP_ROOT/latest" ]]; then
        read -r -p "Renouveler 'latest' vers cette sauvegarde ? [y/N] " renew
        if [[ "${renew,,}" == "y" ]]; then
            ln -sfn "$label" "$BACKUP_ROOT/latest"
            echo "latest -> $label"
        fi
    else
        ln -sfn "$label" "$BACKUP_ROOT/latest"
        echo "latest -> $label"
    fi
    echo "Sauvegarde terminee : $(savedir "$label")"
}

do_restore() {
    local label="$1"
    local src
    src="$(savedir "$label")"
    if [[ ! -d "$src" ]]; then
        echo "Erreur : sauvegarde introuvable : $(savedir "$label")" >&2
        exit 1
    fi
    local mysql_file="$src/disciplina-$label.sql"
    local mongo_file="$src/human_ressources-$label.archive"
    if [[ ! -f "$mysql_file" && ! -f "$mongo_file" ]]; then
        echo "Erreur : aucun fichier de sauvegarde dans $src" >&2
        exit 1
    fi

    echo "Contenu de '$label' :"
    ls -lh "$src" | sed 's/^/  /'
    read -r -p "Restaurer '$label' ? (DESTRUCTIF : ecrase la DB dev) [y/N] " ans
    if [[ "${ans,,}" != "y" ]]; then
        echo "Annule."
        exit 0
    fi

    if [[ -f "$mysql_file" ]]; then
        echo "[1/2] MySQL ..."
        # Le dump ne contient pas de clause USE (dump simple sans --databases) :
        # on cible explicitement la base `disciplina`.
        docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" sql-db \
            mysql -h127.0.0.1 -uroot disciplina < "$mysql_file"
    else
        echo "mysql.sql absent : MySQL ignore."
    fi

    if [[ -f "$mongo_file" ]]; then
        echo "[2/2] MongoDB ..."
        local gzip_opt=()
        # Archives mongodump --archive --gzip (backups du 10/09) : detection pour
        # choisir --gzip a la restauration; sinon --archive brut.
        if gzip -t "$mongo_file" 2>/dev/null; then
            gzip_opt=(--gzip)
            echo "  (archive gzip detectee)"
        fi
        docker compose exec -T -e MONGO_ROOT_USERNAME -e MONGO_ROOT_PASSWORD nosql-db \
            mongorestore --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
            --authenticationDatabase admin --archive "${gzip_opt[@]}" --drop --db human_ressources < "$mongo_file"
    else
        echo "archive mongo absente : MongoDB ignore."
    fi
    echo "Restore termine depuis : $src"
}

prompt_label() {
    local hint="$1" label
    printf 'Label (defaut : %s) > ' "$hint"
    read -r label
    label="${label:-$hint}"
    [[ -n "$label" ]] || { echo "Label vide." >&2; return 1; }
    echo "$label"
}

# --- point d'entree -----------------------------------------------------------
check_env

CMD="${1:-menu}"
shift || true

case "$CMD" in
    backup)
        DEFAULT="$(date +%Y%m%d-%H%M%S)"
        [[ -t 0 ]] && label="$(prompt_label "$DEFAULT")" || label="${1:-$DEFAULT}"
        do_backup "$label"
        ;;
    restore)
        list_backups
        if [[ -t 0 ]]; then
            label="$(prompt_label "$(readlink "$BACKUP_ROOT/latest" 2>/dev/null || echo latest)")"
        else
            label="${1:-latest}"
        fi
        do_restore "$label"
        ;;
    list)
        list_backups
        ;;
    *)
        while true; do
            echo
            echo "=== Backup dev (scripts/backups) ==="
            echo "  1) Backup  (cree une nouvelle sauvegarde)"
            echo "  2) Restaurer une sauvegarde"
            echo "  3) Lister les sauvegardes"
            echo "  0) Quitter"
            printf 'Choix > '
            read -r choice || exit 0
            case "$choice" in
                1)
                    label="$(prompt_label "$(date +%Y%m%d-%H%M%S)")"
                    do_backup "$label"
                    ;;
                2)
                    list_backups
                    label="$(prompt_label "$(readlink "$BACKUP_ROOT/latest" 2>/dev/null || echo latest)")"
                    do_restore "$label"
                    ;;
                3)
                    list_backups
                    ;;
                0 | q | Q | quit)
                    echo "Au revoir."
                    exit 0
                    ;;
                *)
                    echo "Choix invalide : $choice"
                    ;;
            esac
        done
        ;;
esac