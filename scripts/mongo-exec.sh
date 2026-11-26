#!/bin/bash
# Sourced helper (not executed): run a Mongo tool in the nosql-db container
# without the root password ever appearing in a process argument list
# (host `ps` or container `ps`). Used by backup.sh, backup-db.sh, rollback.sh.
#
# The password travels via the environment (set for the docker client only,
# forwarded with `-e VAR` without value) and is written by the shell builtin
# `printf` to a 0600 temp file in the container, passed to the tool with --config.
#
# Requires: MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD set in the caller.
# Usage: mongo_exec mongodump|mongorestore [tool args…]   (stdin/stdout preserved)

read -r -d '' _MONGO_EXEC_SCRIPT <<'EOF' || true
umask 077
cfg=$(mktemp) || exit 1
trap 'rm -f "$cfg"' EXIT
esc=$(printf '%s' "$MONGO_ROOT_PASSWORD" | sed "s/'/''/g")
printf "password: '%s'\n" "$esc" > "$cfg"
tool=$1
shift
"$tool" --config "$cfg" "$@"
EOF

mongo_exec() {
    MONGO_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" \
        docker compose exec -T -e MONGO_ROOT_PASSWORD nosql-db \
        sh -c "$_MONGO_EXEC_SCRIPT" sh "$@"
}
