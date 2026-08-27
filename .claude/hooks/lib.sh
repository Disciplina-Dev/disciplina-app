#!/usr/bin/env bash
# Helpers partagés par les Stop hooks.
# Attend que l'appelant ait mis le JSON stdin dans $INPUT (INPUT="$(cat)").

# Vrai si Claude a déjà été relancé par un Stop hook (stop_hook_active) :
# évite les boucles.
hook_should_skip() {
    [ "$(printf '%s' "${INPUT:-}" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]
}

# Fichiers non committés (working tree + untracked), un par ligne.
# Gère les renommages (on garde la destination) et les chemins avec espaces.
hook_changed_files() {
    git status --porcelain -z --untracked-files=all |
        while IFS= read -r -d '' entry; do
            local status path
            status="${entry:0:2}"
            path="${entry:3}"
            case "$status" in
                R* | C*)
                    # Le nom d'origine suit dans un enregistrement NUL séparé.
                    IFS= read -r -d '' _orig || true
                    ;;
            esac
            printf '%s\n' "$path"
        done | sort -u
}
