# Disciplina

App for apprenticeship management — candidate tracking, company matching, and recruitment follow-up.

## Prerequisites

- **Docker** & **Docker Compose** (required for the full stack)
- **Node.js 18+** (only for running the backend locally without Docker)
- **Python 3.12+** (only for running seed scripts locally)
- **Git**

## Quick Start

```bash
git clone <repo-url> disciplina-app
cd disciplina-app

cp .env.example .env   # edit with your DB credentials
docker compose up
```

### Access points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| GraphQL (companies) | `/api/graphql/companies` |
| GraphQL (candidates) | `/api/graphql/candidates` |
| GraphQL (offers) | `/api/graphql/offers` |
| GraphQL (needs analysis) | `/api/graphql/needs-analysis` |
| MySQL | `localhost:${MYSQL_PORT}` — **4010** unless `.env` overrides it |
| MongoDB | `localhost:${MONGO_PORT}` — **4011** unless `.env` overrides it |

> The database ports are whatever `MYSQL_PORT` / `MONGO_PORT` say in your `.env`; the values above
> are the compose defaults (`${MYSQL_PORT:-4010}:3306`, `${MONGO_PORT:-4011}:27017`) that apply with
> the blank `.env.example`. These are **host-side** ports: inside the compose network the databases
> answer on `sql-db:3306` and `nosql-db:27017`.

### First startup

1. DB init scripts run automatically (MySQL schema + MongoDB collections with `$jsonSchema`)
2. `startup-script` seeds data from CSV files into both databases
3. Backend starts (4 Apollo GraphQL servers + REST routes)
4. Frontend starts (React + Vite)

On subsequent starts, the seed script checks if data already exists and skips seeding.

## Testing

Backend tests are component tests — they boot the real Express app against real Dockerised databases. See [`back/HOWTOTEST.md`](./back/HOWTOTEST.md) for conventions and patterns.

```sh
# Start databases
docker compose up -d sql-db nosql-db

# Run the backend test suite
cd back && npm test

# Reproduce the CI stack locally (ephemeral DBs, no persistent volumes)
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit
```

CI runs automatically on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`). Failing tests appear as inline annotations on the PR diff.

## Backups

Backups run automatically every night on the deployment Mac mini — see [Automatisation (Mac mini)](#automatisation-mac-mini) below. What is still missing is **off-machine storage**: every dump lives on the same disk as the databases it protects, so a disk failure loses both (tracked as `DB-5` in `BACKLOG.md`).

The commands below are the on-demand equivalent, useful before a schema migration or before restoring. Run them against the running `sql-db`/`nosql-db` services with the root `.env` loaded:

```bash
mkdir -p backups

# MySQL
DATE=$(date +%Y-%m-%d_%H%M%S)
docker compose exec -T sql-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" disciplina > "backups/backup_mysql_${DATE}.sql"

# MongoDB
DATE=$(date +%Y-%m-%d_%H%M%S)
docker compose exec -T nosql-db mongodump \
  --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --db human_ressources --archive > "backups/backup_mongo_${DATE}.archive"
```

Dumps land in `./backups/` (gitignored) as `backup_mysql_<DATE>.sql` and `backup_mongo_<DATE>.archive`.

> **Why `root` and not `disciplina_app`?** The application connects as the least-privilege account `disciplina_app` (see [Environment](#environment)), but `mysqldump` needs global read plus `LOCK TABLES`, which that account deliberately lacks. Backups are an administrative task, so they keep using `MYSQL_ROOT_PASSWORD`. The two accounts coexist on purpose.

To restore a dump — **stop the `backend` container first**, otherwise the app writes into a half-restored database:

```bash
docker compose stop backend

# MySQL
docker compose exec -T sql-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" disciplina < backups/backup_mysql_<DATE>.sql

# MongoDB
docker compose exec -T nosql-db mongorestore \
  --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --archive < backups/backup_mongo_<DATE>.archive

docker compose start backend
```

### Automatisation (Mac mini)

**Start the scheduled backup on the Mac mini** (after replacing the two placeholders in the plist — see [Configuration](#configuration) below):

```bash
cp scripts/launchd/com.disciplina.backup.plist ~/Library/LaunchAgents/
$EDITOR ~/Library/LaunchAgents/com.disciplina.backup.plist   # replace the 2 placeholders

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.disciplina.backup.plist
launchctl kickstart -p gui/$(id -u)/com.disciplina.backup    # run once now to prove it works
```

Stop it with `launchctl bootout gui/$(id -u)/com.disciplina.backup`. Details, verification and troubleshooting below.

#### What the script does

`scripts/backup-db.sh` takes no arguments. It resolves the repo root from its own location (so it works from any working directory, which matters under launchd), sources the root `.env`, then:

1. dumps MySQL `disciplina` via `mysqldump` → `backups/backup_mysql_<DATE>.sql`
2. dumps MongoDB `human_ressources` via `mongodump --archive` → `backups/backup_mongo_<DATE>.archive`
3. deletes dumps older than `RETENTION_DAYS` (constant at the top of the script, default `7`)

Every step logs an ISO-8601 timestamped line with the resulting dump size.

#### Configuration

`scripts/launchd/com.disciplina.backup.plist` ships with **two placeholders you must replace** — forgetting them is the most common installation failure:

| Placeholder | Replace with |
|---|---|
| `/ABSOLUTE/PATH/TO/disciplina-app` | the absolute path of the clone, e.g. `/Users/disciplina/disciplina-app` |
| `/Users/YOUR_USER` | the home directory of the account running the agent (both `StandardOutPath` and `StandardErrorPath`) |

The schedule lives in `StartCalendarInterval` (`Hour 3`, `Minute 0` → daily at 03:00). `RunAtLoad` is `false`, so loading the agent does not immediately fire a backup.

The `EnvironmentVariables` → `PATH` key is required: launchd starts agents with a bare `PATH` that does not include the Docker CLI. Without it the script fails with `docker: command not found` at 03:00 while working perfectly when run by hand.

#### Install and verify

```bash
# 1. Copy, then edit the two placeholders in the copy
cp scripts/launchd/com.disciplina.backup.plist ~/Library/LaunchAgents/
$EDITOR ~/Library/LaunchAgents/com.disciplina.backup.plist

# 2. Validate the XML before loading it — launchd silently ignores a malformed plist
plutil -lint ~/Library/LaunchAgents/com.disciplina.backup.plist

# 3. Load it (modern form; `launchctl load` still works but is deprecated)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.disciplina.backup.plist

# 4. Confirm it is registered — second column is the last exit code, 0 means the last run succeeded
launchctl list | grep disciplina

# 5. Force a run now instead of waiting for 03:00 (-p streams the output)
launchctl kickstart -p gui/$(id -u)/com.disciplina.backup

# 6. Check the result
ls -lh backups/
tail -f ~/Library/Logs/disciplina-backup.log
```

Step 5 is the only real proof the job works — do it once at install time. A fresh pair of dumps must appear in `backups/`.

To remove the agent: `launchctl bootout gui/$(id -u)/com.disciplina.backup`.

#### Troubleshooting

| Symptom | Cause |
|---|---|
| `docker: command not found` in the log | The `EnvironmentVariables` → `PATH` key is missing or does not cover your Docker install (`/usr/local/bin` on Intel, `/opt/homebrew/bin` on Apple Silicon). |
| No log file at all, `launchctl list` shows nothing | The plist failed to load — re-run `plutil -lint`, and check the path passed to `bootstrap`. |
| Nothing happens overnight, works with `kickstart` | The Mac mini sleeps at 03:00. `launchd` runs a missed job on wake, but only once; check `pmset -g sched` and consider `sudo pmset repeat wakeorpoweron MTWRFSU 02:55:00`. |
| `.env: No such file or directory` | The script sources the root `.env`; make sure it exists at the repo root and is readable by the account running the agent. |
| `Error response from daemon` / connection refused | The `sql-db` / `nosql-db` containers are not running. The script does not start them. |

Retention is 7 days **on this machine only** — off-machine storage is not implemented yet (`DB-5` in `BACKLOG.md`).

## Project Architecture

```
disciplina-app/
├── back/                 Node.js + TypeScript — Express + Apollo GraphQL
│   ├── src/
│   │   ├── rest/         REST routes — 21 feature modules (auth, email, relance, booking…)
│   │   ├── graphql/      4 Apollo Servers (companies, candidates, offers, needs-analysis)
│   │   ├── mcp/          MCP server (POST /api/mcp)
│   │   ├── scheduler/    Background jobs (pedagogical drafts)
│   │   ├── services/     Business logic layer
│   │   ├── repositories/ MySQL & MongoDB data access
│   │   └── external/     10 integrations — Google, crypto, logger, insee, yousign, ollama…
│   ├── CONVENTION.md     Code style & architecture conventions
│   └── README.md         Backend documentation
├── front/
│   └── disciplina-front/ React 19 + Vite + Tailwind + urql + Zustand
│       └── README.md     Frontend documentation
├── database/
│   ├── mysql/            MySQL init SQL + persistent data volume
│   └── mongodb/          MongoDB init JS with $jsonSchema validation
├── scripts/              Python data import scripts
│   ├── startup.py        Consolidated seed script (Docker entrypoint)
│   └── resource/         CSV data files
└── docker-compose.yaml   Orchestrates all 6 services
```

## Docker Compose Structure

```
┌───────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
│  sql-db   │   │  nosql-db    │   │startup-script│   │  ollama  │
│  MySQL    │   │  MongoDB     │   │(seed, exits) │   │  AI      │
│  :3306    │   │  :27017      │   │              │   │  :11434  │
└─────┬─────┘   └──────┬───────┘   └──────┬───────┘   └────┬─────┘
      │                │                  │                │
      └─────────backend-net────────────────────────────────┘
                         │
                 ┌───────▼────────┐
                 │   backend      │
                 │  Express/Apollo│
                 │   :4000        │
                 └───────┬────────┘
                         │ frontend-net
                 ┌───────▼────────┐
                 │   frontend     │
                 │   React/Vite   │
                 │   :5173        │
                 └────────────────┘
```

The ports shown are the **container** ports. Host-side ports come from `.env`
(`${MYSQL_PORT:-4010}:3306`, `${MONGO_PORT:-4011}:27017`); `ollama` is bound to `127.0.0.1:11434`.

### Services

| Service | Image | depends_on | Restart |
|---------|-------|------------|---------|
| `sql-db` | mysql:8.4.8 | — | always |
| `nosql-db` | mongo:8.2.6 | — | always |
| `ollama` | ollama/ollama:latest | — | always |
| `backend` | custom (back/Dockerfile) | sql-db, nosql-db (healthy) | always |
| `startup-script` | custom (scripts/Dockerfile) | sql-db, nosql-db (healthy) | no |
| `frontend` | custom (front/Dockerfile) | backend (started) | always |

### Networks

- **backend-net**: connects sql-db, nosql-db, ollama, backend, startup-script
- **frontend-net**: connects backend, frontend

### Startup sequence

1. **sql-db** + **nosql-db** initialize (schemas + collections created via `docker-entrypoint-initdb.d/`)
2. **startup-script** runs — reads CSV files from `scripts/resource/`, imports data into both databases, then exits
3. **backend** starts — 4 Apollo GraphQL servers + REST routes mounted on Express
4. **frontend** starts — Vite dev server proxies requests to backend

## Environment

Two `.env` files are loaded at startup:

**Root `.env`** — database credentials:

```env
MYSQL_ROOT_PASSWORD=
MYSQL_PASSWORD=          # required — password of the disciplina_app application account
MYSQL_HOST=sql-db
MYSQL_PORT=3306
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
MONGO_PORT=27017
```

#### MySQL accounts

The application connects as `disciplina_app`, never as `root`. `MYSQL_PASSWORD` is **mandatory**: `docker-compose.yaml` declares it as `${MYSQL_PASSWORD:?}` and refuses to start without it.

- **Fresh volume** — the account is created by the `mysql` image from `MYSQL_USER`/`MYSQL_PASSWORD`, then `database/mysql/mysql-init.sql` narrows its grants. Nothing to do.
- **Existing database** — `mysql-init.sql` never re-runs, so the account does not exist yet and the backend would fail with `Access denied for user 'disciplina_app'`. Create it once with the command below (no data is touched, no table is dropped), or set `MYSQL_USER=root` to keep the previous behaviour.

Creating the account on an existing database:

```bash
# 1. Set MYSQL_PASSWORD in the root .env, then substitute it into the migration script
docker compose up -d sql-db
sed "s/<MOT_DE_PASSE>/${MYSQL_PASSWORD}/" database/mysql/migrations/2026-08-06-app-user.sql \
  | docker compose exec -T sql-db mysql -u root -p"${MYSQL_ROOT_PASSWORD}"

# 2. Confirm the grants — no DROP, no global privilege beyond USAGE
docker compose exec -T sql-db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW GRANTS FOR 'disciplina_app'@'%';"

# 3. Restart the backend, which now connects as disciplina_app
docker compose up -d backend
```

Load the root `.env` first (`set -a; source .env; set +a`) so `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` are set in your shell.

The account has no `DROP` privilege and no global privilege, so `DROP DATABASE`, `DROP TABLE` and reads of `mysql.user` are all refused. Two consequences for queries: `TRUNCATE` requires `DROP` (use `DELETE`), and a `WITH` CTE requires `CREATE TEMPORARY TABLES`. See [`back/CONVENTION.md`](./back/CONVENTION.md) → *Least-privilege account* for the full grant set.

These variables apply to local and self-hosted setups only. Production connects through `MYSQL_URI` (TiDB Cloud), where the account and its grants are managed on the TiDB side.

**`back/.env`** — app secrets (JWT, Google OAuth, SMTP). See `back/README.md` for the full list.

## Contributing

See the detailed documentation in each sub-project:

- **Backend**: [`back/README.md`](./back/README.md) — API reference, architecture layers, command reference
- **Backend conventions**: [`back/CONVENTION.md`](./back/CONVENTION.md) — code style, naming, error handling, auth flow
- **Backend contribution guide**: [`back/HOWTOCONTRIBUTE.md`](./back/HOWTOCONTRIBUTE.md) — how to add features, refactor, fix bugs
- **Backend testing guide**: [`back/HOWTOTEST.md`](./back/HOWTOTEST.md) — component test conventions and patterns
- **Frontend**: [`front/disciplina-front/README.md`](./front/disciplina-front/README.md) — React + Vite setup
- **Database schemas**: [`database/champs.md`](./database/champs.md) — form field reference per Titre Professionnel
- **Data classification**: [`database/DATA_CLASSIFICATION.md`](./database/DATA_CLASSIFICATION.md) — per-table GDPR sensitivity, owning backend domain and retention
- **MongoDB schema**: [`database/mongodb/mongo-schema.md`](./database/mongodb/mongo-schema.md) — candidates, offers and needs_analysis collections documentation
