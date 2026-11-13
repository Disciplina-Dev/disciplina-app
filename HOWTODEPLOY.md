# HOWTODEPLOY

Deployment guide for the production server. This documents how to deploy new
features to production, what to verify before going live, and what special
steps are required for certain features.

## Prerequisites

- SSH access to the production Mac mini
- Git repository cloned on the machine
- Root `.env` and `back/.env` configured with production secrets
- Docker & Docker Compose installed
- [`age`](https://age-encryption.org) installed (`brew install age`) and
  `BACKUP_AGE_RECIPIENT` (public key) set in the root `.env` — backups refuse to
  run without them, see [Backup encryption](#backup-encryption-key-custody--recovery)
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

The script dumps **both tenants** (4 files per run), encrypted with age as they
are written (no plaintext dump ever touches the disk). Verify they all exist
before continuing:

```bash
ls -lh backups/
# La Réunion: backup_mysql_<DATE>.sql.age           + backup_mongo_<DATE>.archive.age
# Annemasse:  backup_annemasse_mysql_<DATE>.sql.age + backup_annemasse_mongo_<DATE>.archive.age
```

Anything in `backups/` not ending in `.age` is a leftover from before encryption:
run the one-off migration (see below).

Annemasse database names come from `MYSQL_ANNEMASSE_DATABASE` /
`MONGO_ANNEMASSE_DATABASE` in the root `.env` (default `disciplina_annemasse`).
The `backup_annemasse_*` prefix is deliberate: `deploy.sh` finds the Réunion
dumps with the `backup_mysql_*` / `backup_mongo_*` globs and must not pick up
Annemasse files. `deploy.sh` records all four paths in `scripts/.deploy-state`.

> Known gap: dumps live on the same disk as the databases — no off-machine
> storage yet (tracked as `DB-5` in `BACKLOG.md`).

### Backup encryption: key custody & recovery

Dumps are encrypted with [age](https://age-encryption.org) using a **public**
recipient. The Mac mini only holds the public key (`BACKUP_AGE_RECIPIENT` in the
root `.env`): it can create backups but cannot read them, so a stolen machine or
disk does not expose past dumps. The **private** key (the age "identity") is only
needed to restore.

**Custody rules**
- The identity lives in a shared password manager entry readable by **at least two
  named people** (holders: `<name 1>`, `<name 2>` — fill in). Optionally, add a
  paper / offline copy in a safe for the case where the password manager is
  unavailable; if there is none, the residual risk is that losing the password
  manager makes every backup unrecoverable (to be accepted by the DPO).
- The identity must **never** be on the Mac mini, in the repo, in `.env` or in
  `backups/`. Fetch it only for a restore, delete the local copy afterwards.
- Losing every copy of the identity means the encrypted backups cannot be read.

**Generate the keypair** (on an admin workstation, not on the Mac mini):

```bash
./scripts/backup-keygen.sh ~/disciplina-backup-identity.txt
# prints BACKUP_AGE_RECIPIENT=age1...  -> put it in the production root .env
# then store the identity in the password manager and delete the local file
```

The script refuses to overwrite a file or to write the identity inside the repo.

**Restore / decrypt**

```bash
# one dump, manually
age -d -i ~/disciplina-backup-identity.txt backups/backup_mysql_<DATE>.sql.age \
  | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db mysql -h127.0.0.1 -uroot disciplina

# rollback.sh decrypts by itself when given the identity
BACKUP_AGE_IDENTITY=~/disciplina-backup-identity.txt ./scripts/rollback.sh
# or: ./scripts/rollback.sh --identity ~/disciplina-backup-identity.txt
```

`rollback.sh` test-decrypts every dump **before** touching the databases, so a
wrong or missing key aborts early with a clear error.

**Rotation**: run `backup-keygen.sh` again and replace `BACKUP_AGE_RECIPIENT`.
Backups already written stay readable only with the *old* identity: keep it until
the retention window (7 days for nightly dumps) has expired.

**One-off migration of pre-existing plaintext dumps** (`backups/` and
`scripts/backups/`, the latter includes the JSON copies written by
`delete_companies.py`):

```bash
./scripts/backup-encrypt-legacy.sh             # dry run: lists the files
./scripts/backup-encrypt-legacy.sh --execute   # encrypts, then deletes the plaintext
```

Plaintext deletion is not guaranteed to be unrecoverable on SSD/APFS: keep
FileVault enabled on the Mac mini.

**Restore test log** (a restore must be tested after any key rotation and at
least once per quarter):

| Date | Who | Dump restored | Result |
|------|-----|---------------|--------|
| 2026-11-12 | qh (GDPR_INF_01.2) | Both tenants, scripted run with a stubbed `docker` (encrypt → decrypt → `rollback.sh` right/wrong/missing key → dry-run → legacy migration) | OK, 28/28 checks. **Not yet** a restore into a real MySQL/MongoDB: do it once on a test instance and add a row. |

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

- `docker compose logs --tail 200 backend frontend` — check for errors
- Jaeger — `http://localhost:16686` — spot-check traces

## 5. Rollback

If something goes wrong, restore the pre-deploy backup and revert the code.
`./scripts/rollback.sh` does all of this and restores **both tenants** (Réunion
and Annemasse) from the dumps recorded in `scripts/.deploy-state`; if the state
file predates the Annemasse backup it warns and skips Annemasse. Dumps are
encrypted: pass the age identity with `--identity <file>` or `BACKUP_AGE_IDENTITY`
(see [Backup encryption](#backup-encryption-key-custody--recovery)). Manual
procedure (pipe each `.age` dump through `age -d -i <identity>` instead of `<`):

```bash
# 1. Stop the backend so it cannot write into a half-restored database
docker compose stop backend

# 2. Restore MySQL
age -d -i "$AGE_IDENTITY" backups/backup_mysql_<DATE>.sql.age \
  | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db mysql -h127.0.0.1 -uroot disciplina

# 3. Restore MongoDB
age -d -i "$AGE_IDENTITY" backups/backup_mongo_<DATE>.archive.age \
  | mongo_exec mongorestore \
  --username "$MONGO_ROOT_USERNAME" \
  --authenticationDatabase admin --archive

# 3b. Restore the Annemasse tenant (MySQL + MongoDB)
age -d -i "$AGE_IDENTITY" backups/backup_annemasse_mysql_<DATE>.sql.age \
  | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker compose exec -T -e MYSQL_PWD sql-db mysql -h127.0.0.1 -uroot disciplina_annemasse
age -d -i "$AGE_IDENTITY" backups/backup_annemasse_mongo_<DATE>.archive.age \
  | mongo_exec mongorestore \
  --username "$MONGO_ROOT_USERNAME" \
  --authenticationDatabase admin --archive --drop --nsInclude 'disciplina_annemasse.*'

# 4. Restart the backend
docker compose start backend

# 5. Revert code and redeploy
git checkout <previous-commit>
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

> Manual Mongo commands use `mongo_exec` (`source scripts/mongo-exec.sh` after exporting `MONGO_ROOT_USERNAME`/`MONGO_ROOT_PASSWORD`): the password is passed via env + a 0600 temp config in the container, never as an argument visible in `ps`. Same for MySQL via `MYSQL_PWD`.

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

**Environment variables (`back/.env`)**

| Variable | Role |
|---|---|
| `MCP_API_KEY` | Static bearer key (≥ 32 chars). Anonymous ADMIN access: **ignored in production** unless `MCP_STATIC_KEY_ENABLED=true` |
| `MCP_STATIC_KEY_ENABLED` | Set to `true` to allow the static key in production (OAuth stays active regardless) |
| `MCP_JWT_SECRET` | Signs OAuth access tokens, distinct from `JWT_SECRET` (empty = fallback to `JWT_SECRET`). Setting it logs out running MCP sessions |
| `MCP_OAUTH_ISSUER_URL` | Public HTTPS issuer URL |

Per-user quotas apply (1000 calls / 2000 records per 24 h, alert at 80 %); access log `mcp_audit_log` is purged after 365 days. See `MCP_RGPD_AUDIT.md`.

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

### Bulk company deletion by SIRET (manual, one-off)

`scripts/delete_companies.py` deletes the companies listed in a text file (one
SIRET per line) from one tenant, MySQL and MongoDB. It is a dry run unless
`--execute` is passed. Companies still linked to live Mongo data (needs analyses,
offers, candidates) are skipped unless `--cascade` is passed. Full details are in
the script docstring.

```bash
./scripts/backup-db.sh                                                   # 1. full backup
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop backend   # 2. freeze writes
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm --no-deps \
  -v "$PWD/scripts:/app" -v "$PWD/<siret_file>:/data/sirets.txt:ro" \
  startup-script python -u delete_companies.py /data/sirets.txt --tenant reunion   # 3. dry run, read the report
# 4. same command + --execute (and --cascade if needed), answer 'y'
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml start backend  # 5. restart and smoke test
```

The databases must be running and the backend stopped. A JSON copy of everything
removed is written to `scripts/backups/` (it contains personal data). The script
does not touch DocuSeal, Drive or `companies_blacklist`, so a later Digiforma
import can re-create deleted companies.

### Candidate contract offer backfill (manual, one-off)

Contracts concluded from an offer used to leave only `status: CONTRACT` on the candidate.
`back/scripts/backfill-candidate-contract-offer.ts` sets `contract_offer_id` / `contract_company_*`
on candidates in contract with no linked offer, from the offer where they appear as `CONTRACT`
(ambiguous cases are skipped and listed). Idempotent; dry run first.

```bash
./scripts/backup-db.sh                                                          # 1. full backup
cd back && npx ts-node scripts/backfill-candidate-contract-offer.ts --dry-run   # 2. read the report
npx ts-node scripts/backfill-candidate-contract-offer.ts                        # 3. apply
```

### Sectors referential audit (manual, before dropping the legacy columns)

`scripts/audit_sectors.py` is a **read-only** check of the sectors migration (#992). The
application no longer writes the legacy label columns (`companies`, `company_conflict`,
`companies_blacklist` `.sector` and `users.sectors`): labels are derived from `sector_id`,
`company_sectors` and `user_sectors`. Run it on **each tenant** after deploying that
release and **before** any `DROP COLUMN` of those columns. It reports, per tenant:

- rows with a legacy label but no `sector_id` / `company_sectors` / `user_sectors` link;
- labels that match no sector of the referential (e.g. leftover `Nord-Est` on Annemasse).

Exit code `0` = safe to drop, `1` = gaps found (the rows are listed), `2` = referential
missing (start the backend once so the migration seeds it). It never writes.

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm --no-deps \
  -v "$PWD/scripts:/app" startup-script python -u audit_sectors.py --tenant reunion
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml run --rm --no-deps \
  -v "$PWD/scripts:/app" startup-script python -u audit_sectors.py --tenant annemasse
```

The backend startup migration backfills the missing links from the legacy labels
(only for rows without a link), so restarting the backend once and re-running the audit
fixes most gaps. Take `./scripts/backup-db.sh` before the `DROP COLUMN` itself.

### Resource sizing and sampling (manual, run on the prod machine)

Two **read-only** scripts quantify what the stack really uses, to size the target server
(see `INFRA_MIGRATION_STUDY.md`). Neither writes to the databases.

- `scripts/infra-specs.sh` — one-shot snapshot: CPU/RAM/disk of the host, Docker limits,
  per-container usage, data directory sizes, MySQL/MongoDB logical sizes.
  `./scripts/infra-specs.sh | tee infra-specs-$(date +%F).txt`
- `scripts/docker-stats-sampler.sh` — records `docker stats` once a minute into `stats/`
  (30-day retention, resource numbers only, git-ignored). `report` prints average / peak
  per container and the peak of the whole stack.

Install the sampler on the Mac mini (same procedure as the backup job):

```bash
cp scripts/launchd/com.disciplina.stats.plist ~/Library/LaunchAgents/
# edit ABSOLUTE/PATH/TO and YOUR_USER in the copied plist, then:
launchctl load ~/Library/LaunchAgents/com.disciplina.stats.plist
./scripts/docker-stats-sampler.sh report     # after a few working days
```

Limits: one sample per minute misses spikes shorter than that (PDF generation, AI calls);
on Docker Desktop the memory limit shown is the VM size, not the Mac's RAM.
