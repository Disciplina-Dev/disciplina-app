# HOWTODEPLOY

Deployment guide for the production server. This documents how to deploy new
features to production, what to verify before going live, and what special
steps are required for certain features.

## Prerequisites

- SSH access to the production Mac mini
- Git repository cloned on the machine
- Root `.env` and `back/.env` configured with production secrets
- Docker & Docker Compose installed
- Caddy configured for TLS termination (public domains proxied to
  `127.0.0.1:8090` frontend / `127.0.0.1:4000` backend)

Production runs with `docker compose -f docker-compose.yaml -f docker-compose.prod.yaml`.
Databases are **not** exposed on host ports (prod override), the frontend is a
nginx production build on `127.0.0.1:8090`, and `NODE_ENV=production` is forced.

## 1. Pre-deploy checklist

- [ ] All feature PRs merged to `main`
- [ ] `main` merged to the `prod` branch (deploys happen from `prod`, never `main`)
- [ ] `CHANGELOG.md` updated with a version bump
      (`## [Unreleased]` → `## [x.y.z] - YYYY-MM-DD`, then a fresh `[Unreleased]`)
- [ ] Frontend changelog synced: `front/disciplina-front/src/content/CHANGELOG.md`
      (the app reads a copy of the changelog — both files must match)
- [ ] Backend tests pass locally: `cd back && npm test`
- [ ] Frontend lint + build pass: `cd front/disciplina-front && npm run lint && npm run build`

## 2. Database backup (mandatory before every deploy)

A nightly automated backup runs at 03:00 via launchd, but a **manual backup is
required before every deploy**.

```bash
cd disciplina-app
./scripts/backup-db.sh
```

Verify the two dumps exist before continuing:

```bash
ls -lh backups/
# backup_mysql_<DATE>.sql  +  backup_mongo_<DATE>.archive
```

> Known gap: dumps live on the same disk as the databases — no off-machine
> storage yet (tracked as `DB-5` in `BACKLOG.md`).

## 3. Deploy

```bash
git checkout prod
git pull origin prod

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
```

Services restart only if their image changed. Check that all containers are up:

```bash
docker compose ps
```

## 4. Post-deploy verification

### Automatic tests (one command, isolated — safe for prod)

This spins up **ephemeral** test databases on separate ports (3307 / 27018) and
runs the full Vitest backend suite, then exits. Production data is **never**
touched.

```bash
docker compose -f docker-compose.test.yml up --build --force-recreate \
  --abort-on-container-exit --exit-code-from test-backend
```

> Do **not** run `cd back && npm test` on the production machine: it connects
> to the live `sql-db`/`nosql-db` containers and pollutes real data with test
> fixtures.

### Manual smoke tests

- [ ] Frontend loads at the production URL
- [ ] Login works (Reunion + Annemasse tenant)
- [ ] Create a candidate
- [ ] Create an offer / analyse de besoin
- [ ] Matching page loads
- [ ] MCP endpoint responds: `POST /api/mcp` without 401

### Log verification

- Dozzle — `http://localhost:9999` — check backend/frontend logs for errors
- Jaeger — `http://localhost:16686` — spot-check traces

## 5. Rollback

If something goes wrong, restore the pre-deploy backup and revert the code.

```bash
# 1. Stop the backend so it cannot write into a half-restored database
docker compose stop backend

# 2. Restore MySQL
docker compose exec -T sql-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" disciplina \
  < backups/backup_mysql_<DATE>.sql

# 3. Restore MongoDB
docker compose exec -T nosql-db mongorestore \
  --username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --archive < backups/backup_mongo_<DATE>.archive

# 4. Restart the backend
docker compose start backend

# 5. Revert code and redeploy
git checkout <previous-commit>
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

## 6. Notes for special features

### Multi-tenant (Annemasse)

Two tenants live in the **same containers**: `disciplina` + `disciplina_annemasse`
(MySQL), `human_ressources` + `disciplina_annemasse` (MongoDB).

**Setting up a new prod machine** — run the migration script so the init
scripts create both databases:

```bash
python scripts/migrate-multi-tenant.py
```

Pipeline: dump → purge volumes → recreate from init scripts (both tenants) →
create dedicated Annemasse app users → restore dumps → verify.

**Dedicated Annemasse accounts.** If `MYSQL_ANNEMASSE_USER` /
`MYSQL_ANNEMASSE_PASSWORD` (MySQL) and `MONGO_ANNEMASSE_USERNAME` /
`MONGO_ANNEMASSE_PASSWORD` (MongoDB) are set in `back/.env`, the script creates
a dedicated least-privilege account for the `disciplina_annemasse` database
(scoped `readWrite`, no DROP, no global privileges). If those variables are
empty, the app falls back to the shared `disciplina_app` account (MySQL) / root
admin user (MongoDB).

**Required env vars in production** (`back/.env`):

```
MYSQL_ANNEMASSE_URI=mysql://...                  # required in prod
MYSQL_ANNEMASSE_USER=                            # optional, falls back to MYSQL_USER
MYSQL_ANNEMASSE_PASSWORD=                        # optional, falls back to MYSQL_PASSWORD
MYSQL_ANNEMASSE_DATABASE=disciplina_annemasse

MONGO_ANNEMASSE_URI=mongodb://...                # required in prod
MONGO_ANNEMASSE_USERNAME=                        # optional, falls back to MONGO_ROOT_USERNAME
MONGO_ANNEMASSE_PASSWORD=
MONGO_ANNEMASSE_DATABASE=disciplina_annemasse

DB_DEFAULT_TENANT=reunion                        # or "annemasse"
```

The backend refuses to boot in production without `MYSQL_ANNEMASSE_URI` /
`MONGO_ANNEMASSE_URI` (`back/src/config/env.ts`).

### MCP server

- `MCP_API_KEY` must be set in `back/.env` (≥ 32 characters)
- Endpoint exposed as `POST /api/mcp` through Caddy
- Smoke test after deploy: call the endpoint and expect a non-401 response

### New MySQL columns

A new column must be added in **two places**, otherwise existing deployments
won't get it:

1. `database/mysql/mysql-init.sql` — only runs on fresh volumes
2. `REQUIRED_COLUMNS` in `back/src/db/mysql/migrations.ts` — backfills existing
   databases at backend boot

`runMysqlMigrations()` applies missing columns automatically on startup — no
manual SQL is needed for column additions on existing databases.