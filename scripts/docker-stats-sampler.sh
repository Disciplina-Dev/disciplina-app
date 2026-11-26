#!/bin/bash
# Records per-container CPU / memory so peaks can be read over days, not from one
# `docker stats` instant. Meant to run every minute via launchd
# (scripts/launchd/com.disciplina.stats.plist).
#
#   docker-stats-sampler.sh            take one sample (default)
#   docker-stats-sampler.sh report     print avg / peak per container + peak of the
#                                      whole stack, over all retained samples
#
# Output: $STATS_DIR/docker-stats_YYYY-MM-DD.csv  (ts,container,cpu_pct,mem_mib,limit_mib)
# Contains resource numbers only — no personal data. Files older than
# RETENTION_DAYS are removed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATS_DIR="${STATS_DIR:-$REPO_ROOT/stats}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$STATS_DIR"

sample() {
    local file="$STATS_DIR/docker-stats_$(date +%F).csv"
    local ts
    ts="$(date +%FT%T%z)"
    [ -s "$file" ] || echo "ts,container,cpu_pct,mem_mib,limit_mib" > "$file"

    # MemUsage looks like "123.4MiB / 7.653GiB"; convert both to MiB.
    docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' |
    awk -F'|' -v ts="$ts" '
        function mib(s,   n, u) {
            n = s + 0
            u = s; gsub(/[0-9.[:space:]]/, "", u)
            if (u == "GiB") return n * 1024
            if (u == "MiB") return n
            if (u == "KiB" || u == "kB") return n / 1024
            if (u == "TiB") return n * 1048576
            return n / 1048576          # plain bytes ("0B")
        }
        {
            split($3, m, " / ")
            gsub(/%/, "", $2)
            printf "%s,%s,%.2f,%.1f,%.1f\n", ts, $1, $2, mib(m[1]), mib(m[2])
        }' >> "$file"

    find "$STATS_DIR" -name 'docker-stats_*.csv' -mtime "+${RETENTION_DAYS}" -delete
}

report() {
    local files
    files=$(ls "$STATS_DIR"/docker-stats_*.csv 2>/dev/null) || { echo "No samples in $STATS_DIR" >&2; exit 1; }
    # shellcheck disable=SC2086
    awk -F, '
        FNR == 1 { next }                      # header of each file
        {
            n[$2]++
            cpu_sum[$2] += $3; mem_sum[$2] += $4
            if ($3 > cpu_max[$2]) { cpu_max[$2] = $3; cpu_at[$2] = $1 }
            if ($4 > mem_max[$2]) { mem_max[$2] = $4; mem_at[$2] = $1 }
            tot_mem[$1] += $4; tot_cpu[$1] += $3
            if (!($1 in seen)) { seen[$1] = 1; samples++ }
            if (first == "" || $1 < first) first = $1
            if ($1 > last) last = $1
            limit = $5
        }
        END {
            printf "Samples: %d  (%s -> %s)\n", samples, first, last
            printf "Memory limit seen by docker: %.0f MiB (VM size on Docker Desktop)\n\n", limit
            printf "%-34s %8s %8s %10s %10s  %s\n", "container", "cpu avg", "cpu max", "mem avg", "mem max", "mem peak at"
            for (c in n)
                printf "%-34s %7.1f%% %7.1f%% %7.0fMi %7.0fMi  %s\n", c, cpu_sum[c]/n[c], cpu_max[c], mem_sum[c]/n[c], mem_max[c], mem_at[c]
            for (t in tot_mem) {
                if (tot_mem[t] > peak_mem) { peak_mem = tot_mem[t]; peak_mem_at = t }
                if (tot_cpu[t] > peak_cpu) { peak_cpu = tot_cpu[t]; peak_cpu_at = t }
                sum_mem += tot_mem[t]
            }
            printf "\nWhole stack, same instant:\n"
            printf "  memory  avg %.0f MiB | peak %.0f MiB at %s\n", sum_mem/samples, peak_mem, peak_mem_at
            printf "  cpu     peak %.0f%% (100%% = 1 core) at %s\n", peak_cpu, peak_cpu_at
            printf "\nCaveat: 1 sample/min only sees what lasts about a minute. A shorter spike (PDF generation, AI call) can fall between two samples.\n"
        }' $files
}

case "${1:-sample}" in
    sample) sample ;;
    report) report ;;
    *) echo "usage: $0 [sample|report]" >&2; exit 2 ;;
esac
