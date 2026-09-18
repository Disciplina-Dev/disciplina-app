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

This section is reserved for **manual, non-scripted** deployment steps tied to
specific features. It is currently empty because everything is automated —
`deploy.sh` / `rollback.sh` handle the deploy itself, `migrate-multi-tenant.py`
the multi-tenant setup, and feature-specific conventions live in `CLAUDE.md` /
`back/CONVENTION.md`.

**Rule:** any new script run at deployment time must be documented here.

### Claude.ai MCP connector (OAuth)

The MCP endpoint also acts as an OAuth 2.1 authorization server so Claude.ai
(web) can authenticate via login + consent instead of a static bearer token.

**Architecture**

- Issuer URL: `https://app-reunion.disciplina.re` (root — `MCP_OAUTH_ISSUER_URL`)
- Connector URL in Claude.ai settings: `https://app-reunion.disciplina.re/api/mcp`
- The OAuth endpoints are served at the **issuer root**, not under `/api/`:
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/oauth-protected-resource/api/mcp`
  - `/register` `/authorize` `/token` `/revoke`

**Caddy requirement (one-time, on the Mac mini)**

Caddy must route the OAuth root paths to the backend (`127.0.0.1:4000`). If Caddy
only proxies `/api/*` to the backend, the OAuth endpoints reach the frontend nginx
and return the SPA `index.html` instead of OAuth JSON metadata, so Claude.ai cannot
complete the discovery/registration/consent flow.

Add a matcher in the `app-reunion.disciplina.re` host block:

```
@appreunion host app-reunion.disciplina.re {
    @mcproute {
        path /.well-known/oauth* /authorize /token /register /revoke
    }
    reverse_proxy @mcproute 127.0.0.1:4000

    reverse_proxy 127.0.0.1:8090
}
```

Reload: `caddy reload`

**Verification**

```bash
curl -i https://app-reunion.disciplina.re/.well-known/oauth-authorization-server
curl -i https://app-reunion.disciplina.re/.well-known/oauth-protected-resource/api/mcp
```

Both must return `application/json` (OAuth metadata) — not `text/html` (SPA).
