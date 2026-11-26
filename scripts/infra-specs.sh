#!/bin/bash
# Read-only snapshot of the host + stack resources, used to size the production
# server (see INFRA_MIGRATION_STUDY.md). Run it from anywhere on the prod machine:
#   ./scripts/infra-specs.sh | tee infra-specs-$(date +%F).txt
# Nothing is modified. Needs a running docker compose stack for sections 3-5.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# .env contains shell metacharacters, so we extract only the keys we need
# (same approach as backup-db.sh).
load_env() {
    [ -f .env ] && grep -E "^${1}=" .env | tail -1 | cut -d= -f2- || true
}

section() { printf '\n== %s ==\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"

section "1. Host hardware ($(date -Iseconds))"
if [ "$OS" = "Darwin" ]; then
    echo "OS:        $(sw_vers -productName) $(sw_vers -productVersion)"
    echo "CPU:       $(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
    echo "Cores:     $(sysctl -n hw.physicalcpu) physical / $(sysctl -n hw.logicalcpu) logical"
    echo "RAM:       $(( $(sysctl -n hw.memsize) / 1073741824 )) GiB"
    system_profiler SPHardwareDataType 2>/dev/null | grep -E "Model Name|Model Identifier|Chip|Memory:" | sed 's/^ */           /'
    echo "Power:     $(pmset -g 2>/dev/null | grep -E '^ *(sleep|displaysleep|disksleep) ' | tr -s ' ' | tr '\n' ';')"
    echo "FileVault: $(fdesetup status 2>/dev/null | head -1)"
else
    echo "OS:        $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
    echo "CPU:       $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ //')"
    echo "Cores:     $(nproc) logical"
    echo "RAM:       $(awk '/MemTotal/ {printf "%.1f GiB", $2/1048576}' /proc/meminfo)"
    echo "Swap:      $(awk '/SwapTotal/ {printf "%.1f GiB", $2/1048576}' /proc/meminfo)"
fi
echo "Uptime/load: $(uptime | sed 's/^ *//')"

section "2. Host disk"
df -h "$REPO_ROOT" | sed 's/^/  /'

section "3. Docker (daemon limits + container usage now)"
if have docker && docker info >/dev/null 2>&1; then
    docker info --format 'Docker {{.ServerVersion}} | NCPU={{.NCPU}} | MemTotal={{.MemTotal}} bytes (VM limit on Docker Desktop)'
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' | sed 's/^/  /'
    echo
    docker system df | sed 's/^/  /'
else
    echo "  docker unavailable — skipped"
fi

section "4. Data on disk (bind mounts and backups)"
for d in database/mysql/mysql-data database/mongodb/mongo-data ollama-data backups; do
    [ -e "$d" ] && printf '  %-34s %s\n' "$d" "$(du -sh "$d" 2>/dev/null | cut -f1)"
done
echo "  backups kept: $(find backups -name 'backup_*' 2>/dev/null | wc -l | tr -d ' ') file(s), oldest: $(ls -1t backups 2>/dev/null | tail -1)"

section "5. Databases (logical size)"
if have docker && docker compose ps --status running --services 2>/dev/null | grep -qx sql-db; then
    MYSQL_ROOT_PASSWORD="$(load_env MYSQL_ROOT_PASSWORD)"
    # Password goes through the container env (MYSQL_PWD), never as a CLI argument.
    docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" sql-db mysql -uroot -t -e "
      SELECT table_schema AS db, ROUND(SUM(data_length)/1048576,1) AS data_mb,
             ROUND(SUM(index_length)/1048576,1) AS index_mb, COUNT(*) AS tables_n
      FROM information_schema.tables
      WHERE table_schema NOT IN ('mysql','sys','information_schema','performance_schema')
      GROUP BY table_schema;
      SELECT table_schema AS db, table_name, table_rows,
             ROUND((data_length+index_length)/1048576,1) AS mb
      FROM information_schema.tables
      WHERE table_schema NOT IN ('mysql','sys','information_schema','performance_schema')
      ORDER BY (data_length+index_length) DESC LIMIT 10;
      SHOW VARIABLES WHERE Variable_name IN ('innodb_buffer_pool_size','max_connections');" 2>&1 | sed 's/^/  /'
else
    echo "  sql-db not running — MySQL skipped"
fi
if have docker && docker compose ps --status running --services 2>/dev/null | grep -qx nosql-db; then
    MONGO_ROOT_USERNAME="$(load_env MONGO_ROOT_USERNAME)"
    MONGO_ROOT_PASSWORD="$(load_env MONGO_ROOT_PASSWORD)"
    docker compose exec -T nosql-db mongosh --quiet \
        -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval '
        db.adminCommand({listDatabases:1}).databases
          .filter(d => !["admin","config","local"].includes(d.name))
          .forEach(d => {
            print("  " + d.name + ": " + (d.sizeOnDisk/1048576).toFixed(1) + " MiB on disk");
            const s = db.getSiblingDB(d.name);
            s.getCollectionNames().forEach(c => {
              const st = s[c].stats();
              if (st.size > 1048576) print("    " + c + ": " + st.count + " docs, " + (st.size/1048576).toFixed(1) + " MiB");
            });
          });' 2>&1
else
    echo "  nosql-db not running — MongoDB skipped"
fi

section "6. Sampler status (peak history)"
STATS_DIR="${STATS_DIR:-$REPO_ROOT/stats}"
if ls "$STATS_DIR"/docker-stats_*.csv >/dev/null 2>&1; then
    echo "  $(ls "$STATS_DIR"/docker-stats_*.csv | wc -l | tr -d ' ') daily file(s) in $STATS_DIR — run: ./scripts/docker-stats-sampler.sh report"
else
    echo "  no samples yet — install the launchd job (see HOWTODEPLOY.md, 'Resource sampling')"
fi

echo
echo "Not measurable from this host: concurrent users per tenant, account counts."
echo "Ask the team, or query the users tables for the active accounts per tenant."
