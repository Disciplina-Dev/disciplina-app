#!/usr/bin/env bash
# Sauvegarde / restauration interactives de la stack dev (MySQL + MongoDB)
# dans scripts/backups/<label>/ — convention : <db>-<label>.sql.age | .archive.age.
# Les dumps sont chiffres a la volee avec age (cle publique BACKUP_AGE_RECIPIENT
# du .env) : aucun clair sur disque. La restauration demande la cle PRIVEE :
# BACKUP_AGE_IDENTITY=<fichier> (jamais dans le repo ni dans .env).
# Les anciens dumps en clair (.sql / .archive) restent restaurables.
#
# Usage :
#   ./scripts/backup.sh                  # menu interactif
#   ./scripts/backup.sh backup [label]   # sauvegarde directe
#   ./scripts/backup.sh restore [label]  # restaure (defaut : latest)
#   ./scripts/backup.sh list             # liste les sauvegardes
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/mongo-exec.sh
source "$REPO_ROOT/scripts/mongo-exec.sh"
BACKUP_ROOT="scripts/backups"

# .env contient des valeurs avec metacaracteres shell : on n'extrait que les cles
# necessaires (meme approche que scripts/backup-db.sh).
load_env() {
    grep -E "^${1}=" .env | tail -1 | cut -d= -f2-
}
MYSQL_ROOT_PASSWORD="$(load_env MYSQL_ROOT_PASSWORD)"
MONGO_ROOT_USERNAME="$(load_env MONGO_ROOT_USERNAME)"
MONGO_ROOT_PASSWORD="$(load_env MONGO_ROOT_PASSWORD)"
# Cle facultative : absente de .env -> vide (grep=1 ferait sinon echouer pipefail).
AGE_RECIPIENT="$(grep -E '^BACKUP_AGE_RECIPIENT=' .env | tail -1 | cut -d= -f2- || true)"
AGE_IDENTITY="${BACKUP_AGE_IDENTITY:-}"

# Umask restrictif : les dumps contiennent des donnees personnelles.
umask 077

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

require_encrypt() {
    command -v age >/dev/null 2>&1 || { echo "Erreur : 'age' introuvable (dnf/brew install age)" >&2; exit 1; }
    if [[ ! "$AGE_RECIPIENT" =~ ^age1[a-z0-9]+$ ]]; then
        echo "Erreur : BACKUP_AGE_RECIPIENT absent ou invalide dans .env (cle PUBLIQUE age1...)" >&2
        exit 1
    fi
}

# Chemin du dump chiffre s'il existe, sinon du dump en clair (ancien format), sinon vide.
pick_dump() {
    local f
    for f in "$1.age" "$1"; do
        [[ -f "$f" ]] && { printf '%s' "$f"; return 0; }
    done
    return 0
}

# Contenu clair d'un dump sur stdout (age -d pour *.age). Toujours utilise en pipe.
dump_cat() {
    if [[ "$1" == *.age ]]; then
        age -d -i "$AGE_IDENTITY" -- "$1"
    else
        cat -- "$1"
    fi
}

# Verifie avant toute action destructive que la cle privee dechiffre les dumps.
check_identity() {
    local f any=0
    for f in "$@"; do [[ "$f" == *.age ]] && any=1; done
    ((any)) || return 0
    command -v age >/dev/null 2>&1 || { echo "Erreur : 'age' introuvable" >&2; exit 1; }
    if [[ -z "$AGE_IDENTITY" || ! -r "$AGE_IDENTITY" ]]; then
        echo "Erreur : dumps chiffres, definir BACKUP_AGE_IDENTITY=<fichier cle privee age>" >&2
        exit 1
    fi
    for f in "$@"; do
        [[ "$f" == *.age ]] || continue
        if [[ -z "$(age -d -i "$AGE_IDENTITY" -- "$f" 2>/dev/null | head -c 1 || true)" ]]; then
            echo "Erreur : dechiffrement impossible (mauvaise cle ?) : $f" >&2
            exit 1
        fi
    done
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
    require_encrypt
    local dest
    dest="$(savedir "$label")"
    mkdir -p "$dest"
    local mysql_file="$dest/disciplina-$label.sql.age"
    local mongo_file="$dest/human_ressources-$label.archive.age"
    if [[ -n "$(pick_dump "$dest/disciplina-$label.sql")" || -n "$(pick_dump "$dest/human_ressources-$label.archive")" ]]; then
        echo "Erreur : une sauvegarde '$label' existe deja." >&2
        exit 1
    fi
    # Un echec ne doit laisser aucun fichier partiel.
    # (double quotes : expansion immediate, les locals n'existent plus a la sortie)
    trap "rm -f '$mysql_file.part' '$mongo_file.part'" EXIT

    echo "[1/2] MySQL (disciplina.companies, candidates... en MySQL) ..."
    env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db \
        mysqldump -h127.0.0.1 -uroot --single-transaction --routines --triggers \
        disciplina | age -r "$AGE_RECIPIENT" > "$mysql_file.part"
    mv "$mysql_file.part" "$mysql_file"

    echo "[2/2] MongoDB (human_ressources.candidates, offers...) ..."
    mongo_exec mongodump \
        --username "$MONGO_ROOT_USERNAME" \
        --authenticationDatabase admin --db human_ressources --archive \
        | age -r "$AGE_RECIPIENT" > "$mongo_file.part"
    mv "$mongo_file.part" "$mongo_file"
    trap - EXIT

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
    local mysql_file mongo_file
    mysql_file="$(pick_dump "$src/disciplina-$label.sql")"
    mongo_file="$(pick_dump "$src/human_ressources-$label.archive")"
    if [[ -z "$mysql_file" && -z "$mongo_file" ]]; then
        echo "Erreur : aucun fichier de sauvegarde dans $src" >&2
        exit 1
    fi
    check_identity ${mysql_file:+"$mysql_file"} ${mongo_file:+"$mongo_file"}

    echo "Contenu de '$label' :"
    ls -lh "$src" | sed 's/^/  /'
    read -r -p "Restaurer '$label' ? (DESTRUCTIF : ecrase la DB dev) [y/N] " ans
    if [[ "${ans,,}" != "y" ]]; then
        echo "Annule."
        exit 0
    fi

    if [[ -n "$mysql_file" ]]; then
        echo "[1/2] MySQL ..."
        # Le dump ne contient pas de clause USE (dump simple sans --databases) :
        # on cible explicitement la base `disciplina`.
        dump_cat "$mysql_file" | env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db \
            mysql -h127.0.0.1 -uroot disciplina
    else
        echo "mysql.sql absent : MySQL ignore."
    fi

    if [[ -n "$mongo_file" ]]; then
        echo "[2/2] MongoDB ..."
        local gzip_opt=()
        # Archives mongodump --archive --gzip (backups du 10/09) : detection pour
        # choisir --gzip a la restauration; sinon --archive brut.
        if [[ "$mongo_file" != *.age ]] && gzip -t "$mongo_file" 2>/dev/null; then
            gzip_opt=(--gzip)
            echo "  (archive gzip detectee)"
        fi
        dump_cat "$mongo_file" | mongo_exec mongorestore \
            --username "$MONGO_ROOT_USERNAME" \
            --authenticationDatabase admin --archive "${gzip_opt[@]}" --drop --db human_ressources
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