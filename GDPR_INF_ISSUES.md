# GDPR infrastructure issues — `GDPR_INF_*`

> Source: `INFRA_RGPD_AUDIT.md` (2026-11-10). Not legal advice; to be validated by the DPO.
> Each `## [GDPR_INF_NN]` block = one **parent issue**. Each `#### [GDPR_INF_NN.k]` block = one **sub-issue** (create it, then link it to its parent via GitHub "Add sub-issue").
> Labels: `gdpr`, `infra`, plus `severity:critical` | `severity:high` | `severity:medium`.
> Title format: `[GDPR_INF_NN] <title>` / `[GDPR_INF_NN.k] <title>`.

## Index

| Code | Severity | Title | Sub-issues |
|---|---|---|---|
| GDPR_INF_01 | Critical | Backups incomplete, unencrypted, no off-site copy | 6 |
| GDPR_INF_02 | Critical | No encryption at rest | 4 |
| GDPR_INF_03 | Critical | Internet exposure from a home box, unversioned proxy config | 3 |
| GDPR_INF_04 | Critical | Observability (Jaeger/OTLP) exposed in prod | 3 |
| GDPR_INF_05 | Critical | No register, DPA, DPIA; Anthropic transfer not qualified | 5 |
| GDPR_INF_06 | High | Data subject rights not implemented | 5 |
| GDPR_INF_07 | High | No effective retention / purge | 3 |
| GDPR_INF_08 | High | Consent not enforced (`warn` mode) | 4 |
| GDPR_INF_09 | High | Frontend Sentry: replay + PII by default | 2 |
| GDPR_INF_10 | High | DocuSeal: code default outside EU | 2 |
| GDPR_INF_11 | High | Undeclared / inaccurate sub-processors | 4 |
| GDPR_INF_12 | High | `veille/`: data and keys tracked by git | 3 |
| GDPR_INF_13 | High | Weak tenant isolation | 3 |
| GDPR_INF_14 | Medium | Databases: Mongo root + no TLS; MySQL TLS not enforced | 3 |
| GDPR_INF_15 | Medium | Logs: no rotation/retention, no read-access journal | 4 |
| GDPR_INF_16 | Medium | No nginx security headers; containers not hardened | 3 |
| GDPR_INF_17 | Medium | Secrets in `.env`, no scanning in CI | 3 |
| GDPR_INF_18 | Medium | In-memory rate-limit; E2E flag to verify | 2 |
| GDPR_INF_19 | Medium | Legal notices / placeholders not filled | 2 |
| GDPR_INF_20 | Medium | Contradictory documentation (Atlas/TiDB) | 2 |

---

## [GDPR_INF_01] Backups incomplete, unencrypted, no off-site copy
**Labels:** `gdpr` `infra` `severity:critical` · **Standard:** Art. 32, S4

### Finding
- `scripts/backup-db.sh` only backs up `disciplina` (MySQL, l. 239) and `human_ressources` (Mongo, l. 245). **`disciplina_annemasse` is never backed up** (MySQL and Mongo). `scripts/rollback.sh` does not restore it either.
- Plain dumps (`.sql`, `.archive`) in `<repo>/backups/` on the **same disk** as the DBs. 7-day retention (`find -mtime +7 -delete`). No off-machine copy (acknowledged in `HOWTODEPLOY.md:48-49`, `README.md:68`, BACKLOG DB-5).
- No restore test, checksum or failure alert.
- Passwords passed as arguments (`-p"$MYSQL_ROOT_PASSWORD"` l. 239, `--password` l. 244): visible in the process list.
- No `umask`/`chmod`: default permissions.
- The Mac mini may sleep at 03:00 (`README.md:177`), delaying or missing the backup.

### Risk
Disk failure, theft, ransomware or mistake = permanent loss of Annemasse data; full leak if the disk is stolen.

### Acceptance criteria
- All sub-issues closed; `Verification` of the audit §6 (encrypted dumps of both tenants + off-site copy + restore on a test instance) passes.

#### [GDPR_INF_01.1] Back up and restore the `disciplina_annemasse` tenant
**Labels:** `gdpr` `infra` `severity:critical`
- Extend `scripts/backup-db.sh` to dump MySQL `disciplina_annemasse` and the Annemasse Mongo database.
- Extend `scripts/rollback.sh` to restore both tenants.
- Update `HOWTODEPLOY.md` (any deploy-time script change must be documented).
- **AC:** a backup run produces dumps for both tenants; rollback restores both on a test instance.

#### [GDPR_INF_01.2] Encrypt backups
**Labels:** `gdpr` `infra` `severity:critical`
- Encrypt dumps at creation (age or restic); key stored outside the backup location; document key custody/recovery.
- **AC:** no plaintext `.sql` / `.archive` left on disk; decryption procedure documented and tested.

#### [GDPR_INF_01.3] Off-site backup copy (3-2-1) at a second EU provider
**Labels:** `gdpr` `infra` `severity:critical`
- 3 copies, 2 media, 1 off-site at an EU provider different from the host; DPA signed (link to GDPR_INF_05.2).
- Define retention aligned with GDPR_INF_07.3.
- **AC:** encrypted copy of both tenants present off-site after each run.

#### [GDPR_INF_01.4] Remove password exposure and tighten file permissions in backup scripts
**Labels:** `gdpr` `infra` `severity:critical`
- Replace `-p"$MYSQL_ROOT_PASSWORD"` (l. 239) and `--password` (l. 244) with `MYSQL_PWD` / an options file; `umask 077` and `chmod` on `backups/`.
- **AC:** no credential visible in `ps` during a backup; backup files mode `600`.

#### [GDPR_INF_01.5] Scheduled restore test, checksum and failure alert
**Labels:** `gdpr` `infra` `severity:critical`
- Write checksum at backup time and verify; periodic automated/documented restore test on a test instance (Art. 32 "test regularly"); alert on backup failure.
- **AC:** failed backup triggers an alert; last successful restore test date recorded.

#### [GDPR_INF_01.6] Make backup run independent of Mac mini sleep
**Labels:** `gdpr` `infra` `severity:high`
- Prevent sleep at 03:00 (`README.md:177`) or reschedule (launchd wake / `pmset`); detect missed runs.
- **AC:** a missed run is detected and alerted. (Superseded once hosting is migrated, see GDPR_INF_03.)

---

## [GDPR_INF_02] No encryption at rest
**Labels:** `gdpr` `infra` `severity:critical` · **Standard:** Art. 32, S2

### Finding
- Mac mini disk not encrypted (FileVault inactive, confirmed). MySQL/Mongo data in bind mounts (`docker-compose.yaml:16`, `./database/mongodb/mongo-data`).
- App-level encryption limited to NIR (AES-256-GCM, `external/crypto/ssn-cipher.ts`; scrypt salt hard-coded `'ssn-salt'`, legacy plaintext SSN tolerated) and Google tokens (`token-cipher.ts`).
- Disability (`psh_*`, `special_needs`), emergency contact, avatars (Mongo Buffer) and `mcp_oauth_clients.client_secret` stored in plaintext.

### Risk
Theft or recovery of the hardware = access to all personal data, including sensitive data.

### Acceptance criteria
- Disk encryption verified (`fdesetup status` / `cryptsetup status`); sensitive fields encrypted; no plaintext NIR remains.

#### [GDPR_INF_02.1] Enable disk encryption (FileVault now, LUKS on target host)
**Labels:** `gdpr` `infra` `severity:critical`
- Enable FileVault on the Mac mini and store the recovery key securely; LUKS on the target server (RAID1 + LUKS).
- **AC:** `fdesetup status` reports On; recovery key custody documented.

#### [GDPR_INF_02.2] Per-deployment scrypt salt for NIR and migrate plaintext NIR
**Labels:** `gdpr` `severity:critical`
- Replace hard-coded `'ssn-salt'` in `external/crypto/ssn-cipher.ts` with a per-deployment secret; plan key rotation/re-encryption.
- Migrate legacy plaintext SSN values and remove the plaintext-tolerance path.
- **AC:** no plaintext SSN in either tenant DB; decrypt works after migration.

#### [GDPR_INF_02.3] Field-level encryption for health/disability data and emergency contacts
**Labels:** `gdpr` `severity:high`
- Evaluate and implement encryption for `psh_*`, `special_needs`, emergency contact (decide scope with DPO; HDS question in GDPR_INF_05.3).
- **AC:** fields encrypted at rest; queries/features relying on them adapted; migration included.

#### [GDPR_INF_02.4] Encrypt avatars and `mcp_oauth_clients.client_secret`
**Labels:** `gdpr` `severity:high`
- Encrypt or hash `client_secret`; decide on avatars (Mongo Buffer) encryption.
- **AC:** secret not stored in clear; decision on avatars recorded.

---

## [GDPR_INF_03] Internet exposure from a home box, unversioned proxy config
**Labels:** `gdpr` `infra` `severity:critical` · **Standard:** Art. 32, S5, S13

### Finding
Service published via box port forwarding. Caddy runs on the host; its config is not versioned (only an excerpt in `HOWTODEPLOY.md:165-176`): TLS, headers and access logs are not auditable. No firewall, VPN, Tailscale or tunnel documented. Operator SSH access undocumented.

### Risk
Direct attack surface on an office machine with no verifiable hardening.

### Acceptance criteria
- `nmap` from outside: only 80/443 open. Caddyfile in repo. SSH via key through VPN only.
- Out-of-repo checks (audit §4): real Caddy config (TLS, HSTS, headers, access logs, versions); open box port forwards; SSH method/keys/allowed IPs; who has physical and logical access to the Mac mini.

#### [GDPR_INF_03.1] Version the Caddyfile
**Labels:** `gdpr` `infra` `severity:critical`
- Commit the real Caddyfile (TLS, HSTS, headers, access logs) and document it in `HOWTODEPLOY.md`.
- **AC:** repo config equals the running config.

#### [GDPR_INF_03.2] Deny-by-default firewall
**Labels:** `gdpr` `infra` `severity:critical`
- Only 80/443 public; DB, Jaeger, OTLP, Ollama never exposed; review box port forwards.
- **AC:** external `nmap` shows only 80/443.

#### [GDPR_INF_03.3] SSH key-only via VPN, documented
**Labels:** `gdpr` `infra` `severity:high`
- Disable password SSH, restrict to VPN/allowed IPs; document operator access.
- **AC:** procedure in `HOWTODEPLOY.md`; password auth disabled.

---

## [GDPR_INF_04] Observability (Jaeger/OTLP) exposed in prod
**Labels:** `gdpr` `infra` `severity:critical` · **Standard:** Art. 25, 32, S5

### Finding
`docker-compose.prod.yaml` resets MySQL/Mongo ports but **not** `jaeger` (16686 UI without auth, 4317) nor `otel-collector` (4318, `docker-compose.yaml:173,181-183`): they stay bound to 0.0.0.0 if the deployment merges both files (`HOWTODEPLOY.md:57-58`). Traces contain HTTP paths and `user.id`; sampling `always_on`; the collector `debug` exporter (`otel-collector.yaml:12-13`, `verbosity: detailed`) writes full traces to container logs.

### Acceptance criteria
- `docker compose -f docker-compose.yaml -f docker-compose.prod.yaml config`: no 0.0.0.0 port outside the reverse proxy.
- Out-of-repo check: ports 16686, 4317, 4318 not reachable from the Internet.

#### [GDPR_INF_04.1] Reset Jaeger and otel-collector ports in prod
**Labels:** `gdpr` `infra` `severity:critical`
- `ports: !reset []` (or `127.0.0.1`) for `jaeger` and `otel-collector` in `docker-compose.prod.yaml`.
- **AC:** merged config shows no public binding for them.

#### [GDPR_INF_04.2] Remove the collector `debug` exporter
**Labels:** `gdpr` `infra` `severity:high`
- Remove `debug` exporter (`otel-collector.yaml:12-13`) from prod pipelines.
- **AC:** traces no longer written to container logs.

#### [GDPR_INF_04.3] Reduce trace sampling and protect the Jaeger UI
**Labels:** `gdpr` `infra` `severity:high`
- Replace `always_on` with reduced sampling; require auth or tunnel access for the UI; review `user.id` in traces (minimization, Art. 5-1-c).
- **AC:** UI not reachable without auth/tunnel; sampling rate documented.

---

## [GDPR_INF_05] No register, DPA, DPIA; Anthropic transfer not qualified
**Labels:** `gdpr` `severity:critical` · **Standard:** Art. 28, 30, 35, 44

### Finding
No general processing register (`rgpd/README.md:50-53`, F3); DPAs "to archive" for Google, Sentry, DocuSeal, ClassMarker (`rgpd/README.md:38-41`), no `rgpd/dpas/` folder; no DPIA. MCP → Anthropic: DPA unsigned, non-EU transfer "to qualify", DPIA not done (`rgpd/registre-mcp.md`, `MCP_RGPD_AUDIT.md` M1). The `ai_processing` consent does not cover a third-party LLM (wording says "local AI summary").

#### [GDPR_INF_05.1] Complete Art. 30 processing register
**Labels:** `gdpr` `severity:critical`
- Cover candidates, apprentices, companies, MCP, péda; recipients, transfers, durations, security measures.
- **AC:** register in `rgpd/`, reviewed by DPO.

#### [GDPR_INF_05.2] Archive DPAs in `rgpd/dpas/`
**Labels:** `gdpr` `severity:critical`
- Google, Sentry, DocuSeal, Yousign, Filiz, Anthropic, ClassMarker (+ hosting and backup providers). Also check for already-signed unarchived contracts.
- **AC:** each processor has an archived DPA or a tracked open action.

#### [GDPR_INF_05.3] DPIA (AI/MCP, NIR, health data)
**Labels:** `gdpr` `severity:critical`
- Include the HDS question for disability data (decide with DPO).
- **AC:** DPIA document approved.

#### [GDPR_INF_05.4] Qualify the Anthropic transfer or disable MCP
**Labels:** `gdpr` `severity:critical`
- SCC + transfer impact assessment; until done, disable the MCP server in prod.
- **AC:** TIA archived, or MCP disabled in prod.

#### [GDPR_INF_05.5] Fix `ai_processing` consent wording
**Labels:** `gdpr` `severity:high`
- Wording must cover a third-party LLM, not only "local AI summary".
- **AC:** updated text and consent version bump.

---

## [GDPR_INF_06] Data subject rights not implemented
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 15-22

### Finding
No export/portability, rectification, objection or consent-withdrawal endpoint for candidates (`RGPD.md` F4, `:222-290`). Erasure only by an HR employee (`deleteCandidate`, `graphql/candidate/resolver.ts:408`). No journal showing a candidate who consulted their data (F14).

#### [GDPR_INF_06.1] Export / portability
**Labels:** `gdpr` `severity:high`
- Documented procedure (1-month deadline) + internal endpoint/tool; machine-readable export including third-party copies (Drive, Filiz, DocuSeal).
- **AC:** export produced for a test candidate.

#### [GDPR_INF_06.2] Rectification and objection
**Labels:** `gdpr` `severity:high`
- **AC:** documented flow + tooling; requests traceable.

#### [GDPR_INF_06.3] Consent withdrawal
**Labels:** `gdpr` `severity:high`
- Shared with GDPR_INF_08.2 (mechanism); this issue covers the rights-request flow.
- **AC:** withdrawal stops dependent processing.

#### [GDPR_INF_06.4] Erasure including third-party copies and backups
**Labels:** `gdpr` `severity:high`
- Extend `deleteCandidate` cascade to Drive, Filiz, DocuSeal, avatars; document backup expiry vs. erasure.
- **AC:** erasure leaves no copy except backups expiring within the stated delay.

#### [GDPR_INF_06.5] Access journal for candidate data (F14)
**Labels:** `gdpr` `severity:high`
- Record who read candidate files, exports, and `unmaskCandidateSsn`; able to answer a candidate's access request.
- **AC:** read/export events logged and queryable. (Shared with GDPR_INF_15.3.)

---

## [GDPR_INF_07] No effective retention / purge
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 5-1-e

### Finding
Existing purges: `external_access`, `refresh_tokens` (D+7), `mcp_audit_log` (365 d), `peda_draft_history.recipient` (365 d), notifications (TTL 48 h), unstarted questionnaire attempts. **No purge** for candidates (by status/age), `candidateHistory`, apprentices, ruptures, companies, `contact_logs`, `relance_history`, KPI `user_name`. No cascade to Drive, Filiz, DocuSeal or the avatars collection. Privacy policy says auto-purge is "in progress" (`politique-confidentialite.md`). Target policy: `database/DATA_CLASSIFICATION.md:28-88`.

#### [GDPR_INF_07.1] Purge/anonymization jobs per `DATA_CLASSIFICATION.md`
**Labels:** `gdpr` `severity:high`
- Candidates, `candidateHistory`, apprentices, ruptures, companies, `contact_logs`, `relance_history`, KPI `user_name`.
- **AC:** jobs scheduled, tested, logged without PII; component tests per backend conventions.

#### [GDPR_INF_07.2] Cascade purge to third parties and avatars
**Labels:** `gdpr` `severity:high`
- Drive, Filiz, DocuSeal, Mongo avatars collection.
- **AC:** purged candidate leaves no third-party copy.

#### [GDPR_INF_07.3] Align backup lifetime with retention durations
**Labels:** `gdpr` `severity:medium`
- **AC:** backup retention documented against each data class; privacy policy updated (GDPR_INF_19).

---

## [GDPR_INF_08] Consent not enforced (`warn`)
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 6-7, 25

### Finding
`assertConsent` in `warn` mode everywhere (`rest/candidates/route.ts:318,524,600,674,717`, `FilizFolderService.ts:149`); only MCP enforces consent strictly. Cookie banner informative only (`CookieBanner.tsx:8-12`): Sentry starts without consent. No consent history (only last date/version), no withdrawal. No consent/information for apprentices, trainers, company contacts.

#### [GDPR_INF_08.1] Switch `assertConsent` to `block`
**Labels:** `gdpr` `severity:high`
- All call sites listed above; component tests for refusal.
- **AC:** no processing without valid consent.

#### [GDPR_INF_08.2] Consent history and withdrawal mechanism
**Labels:** `gdpr` `severity:high`
- Keep every consent event (date, version, scope); allow withdrawal.
- **AC:** history table + migration in both places (`mysql-init.sql` and `REQUIRED_COLUMNS`).

#### [GDPR_INF_08.3] Cookie banner with real choice (Sentry gated)
**Labels:** `gdpr` `severity:high`
- Sentry must not start before opt-in. Frontend: run `npm run lint && npm run build`.
- **AC:** no Sentry network call before consent.

#### [GDPR_INF_08.4] Information/consent for apprentices, trainers and company contacts
**Labels:** `gdpr` `severity:medium`
- **AC:** notice (and consent where required) defined per population.

---

## [GDPR_INF_09] Frontend Sentry: replay + PII by default
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 5-1-c, 25

### Finding
`front/disciplina-front/src/main.tsx:15-40`: replay 10 % of sessions and 100 % on error, `userInfo`/`httpBodies` by default (opt-out lines commented l. 21-24), `debug: true`, `enableLogs: true`, masking not explicit. `VITE_SENTRY_*` mandatory: Sentry always active. DSN region not pinned in code (policy says Germany, `RGPD.md:432` mentions US/Germany).

#### [GDPR_INF_09.1] Disable PII and harden replay
**Labels:** `gdpr` `severity:high`
- `sendDefaultPii: false`, `maskAllText`, `blockAllMedia`; replay disabled or consent-gated; remove `debug: true`, `enableLogs: true`.
- **AC:** replay payload shows masked content; lint + build pass.

#### [GDPR_INF_09.2] Verify prod DSN is EU
**Labels:** `gdpr` `severity:high`
- Prod DSN should be `*.de.sentry.io`; reconcile `RGPD.md:432` and privacy policy.
- **AC:** region confirmed and documented.

---

## [GDPR_INF_10] DocuSeal: code default outside EU
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 44

### Finding
Code default `https://api.docuseal.com` (US) and signing URL `docuseal.com` (`back/src/config/env.ts:209,212`); EU only in a comment. Team says EU in prod; no proof in the repo.

#### [GDPR_INF_10.1] EU defaults in `env.ts`
**Labels:** `gdpr` `severity:high`
- Default to `docuseal.eu` for base and sign URLs.
- **AC:** backend verify passes (`/verify-backend`).

#### [GDPR_INF_10.2] Verify prod `DOCUSEAL_BASE_URL` / `DOCUSEAL_SIGN_URL` and archive DPA
**Labels:** `gdpr` `severity:high`
- **AC:** prod values confirmed EU; DPA archived (GDPR_INF_05.2).

---

## [GDPR_INF_11] Undeclared / inaccurate sub-processors
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 13, 28

### Finding
Policy (`front/disciplina-front/src/content/legal/politique-confidentialite.md:116-128`) lists Brevo (unused: email goes through Gmail OAuth, `back/README.md:261`) and omits: Yousign, Filiz, DuckDuckGo (`external/ddg`, LLM-generated queries with company name/address), Anthropic (MCP), Mistral/OpenAI (n8n `veille*.json`), Google Fonts (`index.css:1`, IP/UA transfer to Google). Google: "EU with possible non-EU access" vs `RGPD.md:429-437` "US". ClassMarker: non-EU, integration still active.

#### [GDPR_INF_11.1] Exact sub-processor table + privacy policy update
**Labels:** `gdpr` `severity:high`
- Role, data, country, DPA per processor; remove Brevo; reconcile Google.
- **AC:** policy matches reality.

#### [GDPR_INF_11.2] Self-host Google Fonts
**Labels:** `gdpr` `severity:medium`
- Remove the Google import in `index.css:1`.
- **AC:** no request to Google fonts; frontend lint/build pass.

#### [GDPR_INF_11.3] Decide fate of n8n LLM workflows
**Labels:** `gdpr` `severity:high`
- Keep (with DPA + register) or remove `veille*.json` Mistral/OpenAI flows (links to GDPR_INF_12.3).
- **AC:** decision recorded.

#### [GDPR_INF_11.4] ClassMarker decision
**Labels:** `gdpr` `severity:medium`
- Non-EU, still active: DPA/transfer basis or removal.
- **AC:** decision recorded.

---

## [GDPR_INF_12] `veille/`: data and keys tracked by git
**Labels:** `gdpr` `severity:high` · **Standard:** Art. 32, S9

### Finding
`veille/n8n/data` (`config` with `encryptionKey`, `database.sqlite` with encrypted credentials, logs) and `veille/rss/data` (`config.php`, Fever key, `users/epitech/config.php`, `db.sqlite`) are tracked by git although `veille/n8n/data/.gitignore` says `data/*`. Workflow `suivi-abs-peda.json` processes student names/emails (Google Sheets → Gmail drafts) outside the register; `veille.json` / `veille-mensuelle.json` send mail content to Mistral/OpenAI without a DPA.

#### [GDPR_INF_12.1] Untrack data directories
**Labels:** `gdpr` `severity:high`
- `git rm --cached` both `data` trees; fix `.gitignore`.
- **AC:** `git ls-files veille | grep data` empty.

#### [GDPR_INF_12.2] Rotate all exposed keys/credentials
**Labels:** `gdpr` `severity:high`
- n8n encryption key and stored credentials, FreshRSS/Fever keys. Git history remains exposed, so rotation is mandatory.
- **AC:** rotation done and recorded.

#### [GDPR_INF_12.3] Register or remove the workflows
**Labels:** `gdpr` `severity:high`
- **AC:** each workflow in the register or deleted.

---

## [GDPR_INF_13] Weak tenant isolation
**Labels:** `gdpr` `infra` `severity:high` · **Standard:** Art. 25, 32, S6

### Finding
One host, one MySQL instance, one Mongo instance; the app connects to Mongo as **root** (`back/src/db/mongo/connection.ts:7-15`) and the Annemasse URI falls back to root credentials if `MONGO_ANNEMASSE_USERNAME` is missing; `disciplina_app` has the same rights on both MySQL databases (`mysql-init.sql:612-618`). Separation relies on code (`db/tenant.ts`, AsyncLocalStorage).

### Risk
A tenant-routing bug or injection exposes both sites.

#### [GDPR_INF_13.1] Per-tenant MySQL accounts
**Labels:** `gdpr` `severity:high`
- Distinct accounts limited to their own database; update `mysql-init.sql` canonical grants and `back/CONVENTION.md` least-privilege section.
- **AC:** each account fails on the other tenant DB.

#### [GDPR_INF_13.2] Non-root Mongo app user, no root fallback
**Labels:** `gdpr` `severity:high`
- Create app users in `mongo-init.js`; remove root fallback in `connection.ts`.
- **AC:** missing tenant credentials = startup error, not root.

#### [GDPR_INF_13.3] Longer term: separate instances or hosts per tenant
**Labels:** `gdpr` `severity:medium`
- Evaluate with the migration (GDPR_INF_03).
- **AC:** decision recorded.

---

## [GDPR_INF_14] Databases: Mongo root + no TLS; MySQL TLS not enforced
**Labels:** `gdpr` `infra` `severity:medium` · **Standard:** Art. 32, S3, S6

### Finding
- Mongo without TLS nor least-privilege user (`mongo-init.js` creates no app user).
- MySQL: no `REQUIRE SSL` / `require_secure_transport`; client-side TLS only (`MYSQL_SSL_CA`), self-signed cert without host verification (`db/mysql/connection.ts:9-22`); `@'%'` account; `mysql-init.sql` runs only on a fresh volume.
- `startup-script`, `backup-db.sh`, `rollback.sh` use root.

#### [GDPR_INF_14.1] Mongo TLS and least-privilege user
**Labels:** `gdpr` `severity:medium`
- Overlaps GDPR_INF_13.2 for the user part; this issue covers TLS.
- **AC:** Mongo connections encrypted (or local socket).

#### [GDPR_INF_14.2] Enforce MySQL TLS and host verification
**Labels:** `gdpr` `severity:medium`
- `require_secure_transport`, `REQUIRE SSL`, proper CA with host verification, restrict `@'%'`; ship via migration since init script only runs on fresh volumes.
- **AC:** non-TLS connection refused.

#### [GDPR_INF_14.3] Stop using root in scripts
**Labels:** `gdpr` `severity:medium`
- `startup-script`, `backup-db.sh`, `rollback.sh`: dedicated accounts with minimal grants; document in `HOWTODEPLOY.md`.
- **AC:** no root credential in those scripts.

---

## [GDPR_INF_15] Logs: no rotation/retention, no read-access journal
**Labels:** `gdpr` `infra` `severity:medium` · **Standard:** Art. 5-1-e, 33, S7

### Finding
Docker `json-file` logs with no rotation or retention (no `logging:` in compose files). Pino `redact` limited to the root and two levels (`external/logger/logger.ts:41-87`); error stacks may contain PII. No read-access journal for candidate files nor trace of exports / `unmaskCandidateSsn` (F14), which hampers breach detection (Art. 33). `deploy.sh:241` prints error log lines to the terminal.

#### [GDPR_INF_15.1] Docker log rotation and retention
**Labels:** `gdpr` `infra` `severity:medium`
- `logging:` with `max-size`/`max-file` in compose; retention 6-12 months for security logs (CNIL).
- **AC:** logs bounded.

#### [GDPR_INF_15.2] Deepen Pino redaction
**Labels:** `gdpr` `severity:medium`
- Cover deeper paths and error stacks; keep `{ err: error }` convention.
- **AC:** test proving PII keys are redacted at depth.

#### [GDPR_INF_15.3] Read-access / export audit trail
**Labels:** `gdpr` `severity:medium`
- Shared with GDPR_INF_06.5.
- **AC:** events for reads, exports and `unmaskCandidateSsn`.

#### [GDPR_INF_15.4] Stop printing log lines in `deploy.sh:241`
**Labels:** `gdpr` `severity:medium`
- **AC:** terminal output shows counts/status only.

---

## [GDPR_INF_16] No nginx security headers; containers not hardened
**Labels:** `gdpr` `infra` `severity:medium` · **Standard:** S10, S11

### Finding
`front/disciplina-front/nginx.conf`: HTTP on port 80, no security headers (CSP/HSTS/X-Frame-Options only on the API via Helmet, `back/src/index.ts:83-110`, production only). Containers: nginx and scripts run as root, `:latest`/unpinned images (ollama, otel-collector, jaeger, `node:alpine`, `nginx:alpine`), no `read_only`/`cap_drop`/`no-new-privileges`, no resource limits, no healthchecks.

#### [GDPR_INF_16.1] nginx security headers
**Labels:** `gdpr` `severity:medium`
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **AC:** headers present on frontend responses.

#### [GDPR_INF_16.2] Pin container images
**Labels:** `gdpr` `infra` `severity:medium`
- Pin ollama, otel-collector, jaeger, `node`, `nginx` to explicit versions.
- **AC:** no `:latest`/floating tag in compose or Dockerfiles.

#### [GDPR_INF_16.3] Container hardening
**Labels:** `gdpr` `infra` `severity:medium`
- Non-root user, `no-new-privileges`, `cap_drop`, `read_only` where possible, resource limits, healthchecks.
- **AC:** hardening flags in compose; stack still boots.

---

## [GDPR_INF_17] Secrets in `.env`, no scanning in CI
**Labels:** `gdpr` `infra` `severity:medium` · **Standard:** S9, S10

### Finding
Secrets in `.env` files and env vars; no secrets manager / Docker secrets. `RGPD.md` F11 reports secrets in the repo (values not re-read in the audit). CI (`.github/workflows/ci.yml`) runs no frontend lint/build, no secret scan, no image scan, no SAST; Dependabot does not cover Docker; actions pinned by tag, not SHA.

#### [GDPR_INF_17.1] Secrets management and repo secret review
**Labels:** `gdpr` `severity:medium`
- Docker secrets or manager; verify F11 and rotate anything committed; rotation policy.
- **AC:** no secret in git; documented rotation.

#### [GDPR_INF_17.2] CI security checks
**Labels:** `gdpr` `infra` `severity:medium`
- Frontend lint/build, secret scan, image scan, SAST.
- **AC:** jobs run on PR and block on findings.

#### [GDPR_INF_17.3] Dependabot for Docker and SHA-pinned actions
**Labels:** `gdpr` `infra` `severity:medium`
- **AC:** `dependabot.yml` covers docker; actions pinned by SHA.

---

## [GDPR_INF_18] In-memory rate-limit; E2E flag to verify
**Labels:** `gdpr` `severity:medium` · **Standard:** S5

### Finding
Limiters are in memory (`rest/middleware/rateLimiter.ts`): counters lost on restart. `E2E_DISABLE_LOGIN_RATE_LIMIT` disables login limiting.

#### [GDPR_INF_18.1] Persistent rate-limit store
**Labels:** `gdpr` `severity:medium`
- **AC:** counters survive a restart; component test.

#### [GDPR_INF_18.2] Verify `E2E_DISABLE_LOGIN_RATE_LIMIT` is absent in prod
**Labels:** `gdpr` `severity:high`
- Check prod `.env`; consider refusing the flag when `NODE_ENV=production`.
- **AC:** absence confirmed.

---

## [GDPR_INF_19] Legal notices / placeholders not filled
**Labels:** `gdpr` `severity:medium` · **Standard:** Art. 13

### Finding
`front/disciplina-front/src/content/legal/mentions-legales.md:40`: host = "Disciplina Réunion, auto-hébergement (Mac mini + Docker)"; Annemasse not mentioned; placeholders `[[NOM_ORGANISME]]` and `[[EMAIL_DPO]]` not filled (`_placeholders.md`). Update after migration.

#### [GDPR_INF_19.1] Fill `[[NOM_ORGANISME]]` and `[[EMAIL_DPO]]`
**Labels:** `gdpr` `severity:medium`
- **AC:** no `[[...]]` placeholder left in rendered legal pages.

#### [GDPR_INF_19.2] Update host and Annemasse mentions
**Labels:** `gdpr` `severity:medium`
- Re-do after hosting migration.
- **AC:** hosting info accurate for both sites.

---

## [GDPR_INF_20] Contradictory documentation (Atlas/TiDB)
**Labels:** `gdpr` `severity:medium` · **Standard:** Art. 30

### Finding
`AUDIT_DEPS.md:145` says the root `.env` points to Atlas/TiDB; `env.ts:146` and `db/mysql/connection.ts:9-11` mention TiDB Cloud; `back/vercel.json` exists. Team confirms prod is on the Mac mini.

#### [GDPR_INF_20.1] Clean up Atlas/TiDB/Vercel references
**Labels:** `gdpr` `severity:medium`
- **AC:** docs and code comments consistent with the Mac mini reality.

#### [GDPR_INF_20.2] Verify no cloud DB ever held prod data (or that it is purged)
**Labels:** `gdpr` `severity:medium`
- **AC:** answer recorded; purge proof if applicable.

---

## Cross-cutting: migration (target architecture)
Tracked through GDPR_INF_01/02/03/13/16/19: EU host (DPA, ISO 27001), single site for both tenants, RAID1 + LUKS, deny-by-default firewall, 3-2-1 backups, external uptime monitoring, documented DRP (RPO/RTO), then secure wipe of the Mac mini and update of legal notices, register and `HOWTODEPLOY.md`.
