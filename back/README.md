# Disciplina — Backend

Node.js/TypeScript API server (Express + Apollo GraphQL + REST).

## Quick start (Docker)

The easiest way to run the full stack:

```sh
docker compose up --build
```

This starts MySQL, MongoDB, the backend (port 4000), a seed/startup script, and the frontend. For manual setup or local development, see [Environment](#environment).

## Architecture

```
src/
  index.ts              Entry point — bootstraps Express, mounts all routes & GraphQL
  config/env.ts         Hand-rolled environment validator (exits on invalid/missing vars)
  db/
    mongo/connection.ts Mongoose connection (DB: human_ressources)
    mongo/schemas/      11 Mongoose schemas (candidates, offers, needs_analysis, notifications…)
    mysql/connection.ts MySQL2 connection pool (DB: disciplina)
    mysql/migrations.ts runMysqlMigrations() — auto-applies missing columns at boot
  external/             10 third-party integrations & cross-cutting infrastructure
    google/             OAuth2 client, GoogleDriveService, GoogleGmailService, MIME builder, types
    crypto/             HmacService, timing-safe compare + domain signers (relance URL, OAuth state)
    logger/             pino logger instance
    insee/              SireneService — INSEE Sirene API client (SIRET/SIREN lookup & search)
    filiz/              FilizAuthClient + FilizService — Filiz ERP OAuth + degree/class APIs
    yousign/            Yousign e-signature client
    docuseal/           DocuSeal e-signature client
    ddg/                DuckDuckGo search
    ollama/             Local AI (see the `ollama` compose service)
    scraper/            Web scraping (puppeteer)
  graphql/
    server.ts           4 separate ApolloServer instances on different paths
    context.ts          JWT extraction from Authorization header
    authGuard.ts        Role-based access guard
    company/            Companies GraphQL (MySQL)
    todo/               Todos GraphQL — merged into the companies server (also holds changePassword)
    needsAnalysis/      Needs-analysis GraphQL (MongoDB) — its own server
    candidate/          Candidates GraphQL (MongoDB)
    offers/             Offers GraphQL + matching logic (MongoDB)
  mcp/                  MCP server (POST /api/mcp) — own auth + rate limiter, tools per domain
  scheduler/            pedaDraftScheduler — started from index.ts
  repositories/
    mysql/              16 repositories: UserRepository, CompanyRepository, CompanyBlacklistRepository,
                        MatchLinkRepository, InterviewAccessRepository, FilizRepository…
    mongo/              7 repositories: CandidateRepository, OfferRepository, NeedsAnalysisRepository…
  services/             ~30 services: CompaniesService, CompaniesBlacklistService, UserService,
                        CandidateService, OfferService, NeedsAnalysisService, KpiService, PdfService,
                        pagination (cursor pagination helpers)
    mappers/            Snake-case ↔ camelCase mappers for user, company, candidate (MySQL side only)
  rest/                 21 feature modules + middleware/ + shared/
    auth/               Login, register, Google OAuth
    email/              Gmail email sending + drafts (via external/google)
    relance/            Candidate follow-up emails with HMAC-signed tracking links
    candidates/         Quick-create candidate endpoint + CV upload to Drive
    classmarker/        ClassMarker test links and webhooks
    sourcing/           SIREN/SIRET/multicriteria prospecting search via INSEE, blacklist-aware
    yousign/            Yousign signature webhook + SSE stream for needs-analysis signing
    docuseal/           DocuSeal signature webhook
    kpi/ rh-kpi/        Commercial and RH KPI dashboards — manual entry + Excel import
    external/           Guest magic-link flows for candidates / companies (cookie `disc_at` + 6-digit code; ref 1 CV import, ref 2 matching, ref 3 interview slots)
    booking/ calendar/  Interview slots and calendar
    matching/           Candidate ↔ offer matching endpoints
    needsAnalysis/      Needs-analysis REST endpoints
    notifications/      SSE notification stream
    peda/               Pedagogical drafts (see scheduler/)
    mailTemplates/      Mail templates CRUD
    sectorSettings/     Sector reference settings
    filiz/              Filiz ERP endpoints
    middleware/         Auth (JWT), error handler, rate limiters, role guard, webhook signature
    shared/             Cross-module REST helpers
  types/                Domain types: user, company, candidate, offer, needs-analysis, db-rows
  utils/                Misc helpers
```

## GraphQL endpoints

| Path | Server | Domain | Database |
|------|--------|--------|----------|
| `/api/graphql/companies` | `CompanyAPI` | Companies + Users + Todos | MySQL |
| `/api/graphql/candidates` | `CandidateAPI` | Candidates | MongoDB |
| `/api/graphql/offers` | `OfferAPI` | Offers + candidate matching | MongoDB |
| `/api/graphql/needs-analysis` | `NeedsAnalysisAPI` | Needs analysis ("Analyse de Besoin") | MongoDB |

All use the same JWT context (`back/src/graphql/context.ts`). Mounted in `index.ts:142-152`.

The `/api/graphql/companies` server merges `graphql/company/` (companies, users,
`blacklistCompany`), `graphql/todo/` (todos, plus the `changePassword` user mutation) and the
shared `User` typeDefs into one Apollo instance (`graphql/server.ts`).

Needs-analysis is **its own server** on `/api/graphql/needs-analysis` (`needsAnalysis(id)`,
`needsAnalysesByCompany(companyID)`, `createNeedsAnalysis`, `updateNeedsAnalysis`,
`deleteNeedsAnalysis`) and reads MongoDB — it was migrated out of MySQL and is no longer merged
into the companies server.

## REST endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | None | Login → JWT + user |
| POST | `/api/auth/register` | JWT (ADMIN) | Register new user |
| POST | `/api/auth/google/uri` | JWT | Generate Google OAuth URI (admin can pass `userId` for another user) |
| POST | `/api/auth/google/token` | None | Exchange OAuth code for Google tokens |
| GET | `/api/logout` | Session | Destroy session |
| POST | `/api/email/send` | JWT | Send email (rate-limited: 20/15min) |
| POST | `/api/email/draft` | JWT | Create a Gmail draft (supports an optional attachment) |
| POST | `/api/relance/send` | JWT | Send relance emails (rate-limited: 5/hour) |
| GET | `/api/relance/response` | None | Handle relance OUI/NON click-through |
| GET | `/api/classmarker/links` | JWT (RH / ADMIN) | Get ClassMarker test links |
| POST | `/api/webhooks/classmarker` | None | ClassMarker webhook (saves test result) |
| GET | `/api/webhooks/classmarker/stream` | None | SSE stream for live ClassMarker results |
| GET | `/api/webhooks/classmarker/result/:candidateId` | None | Fetch stored ClassMarker result |
| POST | `/api/webhooks/yousign` | None | Yousign webhook — needs-analysis signature completed |
| GET | `/api/webhooks/yousign/stream` | None | SSE stream of signature status for a commercial (`?userID=`) |
| POST | `/api/candidates/quick-create` | JWT (RH / ADMIN) | Quick-create a candidate (dedup by name) |
| POST | `/api/candidates/:id/cv` | JWT (RH / ADMIN) | Upload a candidate's CV (PDF) to their Google Drive folder |
| POST | `/api/sourcing/search` | JWT | Find additional prospect contacts by name/address |
| GET | `/api/sourcing/:siren` | JWT | Search establishments by SIREN; blacklist-aware (short-circuits if the whole SIREN is banned) |
| GET | `/api/sourcing/:siret` | JWT | Validate a SIRET against INSEE; flags whether it's already in the portfolio |
| POST | `/api/sourcing/multicriteria` | JWT | Multi-criteria INSEE search (commune / NAF code / SIREN), excludes companies already in the portfolio |
| GET | `/api/kpi/years` | JWT (ADMIN / RESPONSABLE) | List years with KPI data |
| GET | `/api/kpi/summary` | JWT (ADMIN / RESPONSABLE) | Annual KPI summary per commercial (`?year=&site=`) |
| GET | `/api/kpi/monthly` | JWT (ADMIN / RESPONSABLE) | Monthly KPI breakdown (`?year=&site=`) |
| GET | `/api/kpi/weekly` | JWT (ADMIN / RESPONSABLE) | Weekly KPI breakdown (`?year=&site=`) |
| POST | `/api/kpi` | JWT (ADMIN / RESPONSABLE) | Manually upsert one KPI row |
| POST | `/api/kpi/import` | JWT (ADMIN / RESPONSABLE) | Import KPI data from an uploaded Excel file (`multipart/form-data`, field `file`) |

## Commands

```sh
npm run dev       # ts-node-dev --respawn --transpile-only src/index.ts
npm run build     # tsc (outputs to dist/)
npm start         # node dist/index.js
npm test          # vitest run
npm run test:watch  # vitest (watch mode)
npm run lint      # oxlint
npm run lint:fix  # oxlint --fix
npm run format    # prettier --write src/
npm run format:check  # prettier --check src/
```

## Testing

Component tests boot the Express app against real Dockerised databases. See [`HOWTOTEST.md`](./HOWTOTEST.md) for conventions and patterns.

```sh
# Start databases (Docker required)
docker compose up -d sql-db nosql-db

# Run all tests
npm test

# Run specific test file
npx vitest run src/graphql/candidate/__tests__/query.test.ts

# Watch mode
npm run test:watch
```

The test environment is configured in `.env.back.example` — MySQL on `localhost:5001`, MongoDB on `localhost:27017`, test database `human_ressources_test`.

To reproduce exactly what CI does (ephemeral databases, no persistent volumes), run from the project root:

```sh
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit
```

CI runs automatically on every push and pull request (`.github/workflows/ci.yml`). Failing tests appear as inline annotations on the PR diff.

## Pre-commit hooks

This project uses [pre-commit](https://pre-commit.com) to run Prettier and lightweight checks on staged files before each commit.

```sh
# one-time setup
python3 -m pip install pre-commit
python3 -m pre_commit install

# run on all files (optional — hooks auto-run on git commit)
python3 -m pre_commit run --all-files
```

Active hooks:

| Hook | Files | Purpose |
|------|-------|---------|
| Prettier | `back/src/*.ts` | Format TypeScript |
| trailing-whitespace | All | Trim trailing whitespace |
| end-of-file-fixer | All | Files end with newline |
| check-yaml | `.yaml` / `.yml` | Valid YAML |
| check-json | `.json` | Valid JSON |

## Environment

Two `.env` files are loaded at startup:

**Root `.env`** (DB credentials):

```
MYSQL_ROOT_PASSWORD=
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
```

**`back/.env`** (app config):

```
API_PORT=4000
SESSION_SECRET=
JWT_SECRET=
OAUTH_ENCRYPTION_KEY=   # 64-char hex — generate with: openssl rand -hex 32
MYSQL_USER=root
MYSQL_DATABASE=disciplina
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google
APP_BASE_URL=http://localhost:4000
RELANCE_HMAC_SECRET=change-this-relance-secret
GOOGLE_STATE_SECRET=change-this-google-state-secret

# INSEE Sirene API (optional — SIRET/SIREN lookup in external/insee/)
INSEE_API_KEY=

# Filiz ERP integration (external/filiz/) — required, CI uses fallback values
FILIZ_CLIENT_ID=
FILIZ_CLIENT_SECRET=
FILIZ_AUDIENCE=
FILIZ_BASE_URI=https://api.dev.partners.filiz.io
FILIZ_AUTH_URI=

# Yousign e-signature for needs-analysis (rest/yousign/) — sandbox defaults provided
YOUSIGN_API_KEY=
YOUSIGN_BASE_URL=https://api-sandbox.yousign.app/v3
```

> Note: `SMTP_*` env vars are recognized but unused today. Email sending goes through Gmail OAuth (`external/google/gmail.service.ts`), not SMTP/Brevo/nodemailer.

All vars are validated by `back/src/config/env.ts` (hand-rolled validator) — the server exits immediately if anything is missing or invalid.

### Insecure default warnings

In dev, `JWT_SECRET` and `SESSION_SECRET` warn if set to known insecure values. In production, the server exits.

## Databases

### MySQL (`disciplina`)
- 18 tables: `users`, `companies`, `companies_blacklist`, `company_history`, `contact_logs`,
  `relance_history`, `commercial_kpi`, `rh_kpi`, `sector_settings`, `booking_settings`,
  `interview_access`, `match_link`, `todos`, `peda_config`, `peda_draft_history`, `app_settings`,
  `filiz`, `needs_analysis`
- ⚠️ `needs_analysis` is **dead**: the entity moved to MongoDB and no code reads this table
  anymore, but `mysql-init.sql` still creates it. See `docs/AUDIT.md` §6.3.
- Init: `database/mysql/mysql-init.sql`
- Connection pool via `mysql2/promise` (10 connections)
- `db/mysql/migrations.ts` (`runMysqlMigrations()`) runs at boot after connecting and adds any
  columns from a hardcoded list that are missing on the live database — see
  [`CONVENTION.md`](./CONVENTION.md#schema-migrations)

### MongoDB (`human_ressources`)
- 11 collections: `candidates`, `candidate_history`, `candidate_avatars`, `offers`,
  `needs_analysis`, `notifications`, `mail_templates`, `mail_signatures`, `ab_drive_config`,
  `drive_folder_config`, `jobs`
- ⚠️ `jobs` is **dead**: replaced by `offers` + `offers.matching`, no code reads it, yet
  `mongo-init.js:28` still creates it. See `docs/AUDIT.md` §6.3.
- Schema reference: [`database/mongodb/mongo-schema.md`](../database/mongodb/mongo-schema.md)
- Init: `database/mongodb/mongo-init.js` (`$jsonSchema` validation)
- Mongoose with `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`

## Auth flow

1. **Register**: `POST /api/auth/register` → bcrypt hash → insert user
2. **Login**: `POST /api/auth/login` → verify password → return JWT (24h expiry)
3. **REST auth**: `Authorization: Bearer <token>` → `authenticate()` middleware attaches `req.user`
4. **GraphQL auth**: Same header → `context.ts` verifies JWT → attaches `user` to Apollo context
5. **Google OAuth**: `POST /api/auth/google/uri` → HMAC-signed state → popup auth → `POST /api/auth/google/token` → tokens stored in MySQL `users` table

## Key dependencies

- `@apollo/server` ^4 — GraphQL
- `express` ^4.18 — HTTP framework
- `mysql2` ^3.9 — MySQL driver
- `mongoose` ^9.5 — MongoDB ODM
- `jsonwebtoken` ^9.0 — JWT auth
- `bcrypt` ^6.0 — Password hashing
- `googleapis` ^171 — Google APIs (Drive, Calendar, Gmail)
- `pdfkit` ^0.18 — PDF generation (candidate PDFs)
- `pdf-lib` ^1.17 — PDF generation/manipulation (needs-analysis PDFs)
- `multer` ^2.1 — multipart file upload (KPI Excel import)
- `xlsx` ^0.18 — Excel parsing (KPI Excel import)
- `pino` ^10.3 — Logging
- `express-rate-limit` ^8.5 — Rate limiting
- `express-session` ^1.19 — Session middleware
- `oxlint` ^0.64 — Linter (Rust-based)
- `vitest` ^2.0 — Test runner
