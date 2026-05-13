# Disciplina — Backend

Node.js/TypeScript API server (Express + Apollo GraphQL + REST).

## Architecture

```
src/
  index.ts              Entry point — bootstraps Express, mounts all routes & GraphQL
  config/env.ts         Zod-validated environment config (exits on invalid/missing vars)
  db/
    mongo/connection.ts Mongoose connection (DB: human_ressources)
    mongo/schemas/      Mongoose schemas for candidates & jobs
    mysql/connection.ts MySQL2 connection pool (DB: sales_service)
  graphql/
    server.ts           3 separate ApolloServer instances on different paths
    context.ts          JWT extraction from Authorization header
    authGuard.ts        Role-based access guard
    company/            Companies GraphQL (MySQL)
    candidate/          Candidates GraphQL (MongoDB)
    jobs/               Jobs GraphQL + matching logic (MongoDB)
  repositories/
    mysql/              Data access: UserRepository, SalePersonRepository, CompanyRepository
    mongo/              Data access: CandidateRepository, JobRepository
  services/             Business logic: CompaniesService, UserService, CandidateService,
                        JobService, SalePersonsService, PdfService
    mappers/            Snake-case ↔ camelCase mappers for user, company, candidate
  rest/
    auth/               Login, register, Google OAuth
    email/              SMTP email sending (nodemailer, Brevo)
    google/             Google API client, types, DriveService
    relance/            Candidate follow-up emails with HMAC-signed tracking links
    middleware/         Auth (JWT), error handler & rate limiters
  types/                Domain types: user, company, candidate, job, db-rows
  utils/                Logger (pino) & HMAC signing
```

## GraphQL endpoints

| Path | Domain | Database |
|------|--------|----------|
| `/api/graphql/companies` | Companies + SalePersons | MySQL |
| `/api/graphql/candidates` | Candidates | MongoDB |
| `/api/graphql/jobs` | Jobs + candidate matching | MongoDB |

All use the same JWT context (`back/src/graphql/context.ts`).

## REST endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | None | Login → JWT + user |
| POST | `/api/auth/register` | JWT (ADMIN) | Register new user |
| POST | `/api/auth/google/uri` | JWT | Generate Google OAuth URI (admin can pass `userId` for another user) |
| POST | `/api/auth/google/token` | None | Exchange OAuth code for Google tokens |
| POST | `/api/email/send` | None | Send email (rate-limited: 20/15min) |
| POST | `/api/relance/send` | None | Send relance emails (rate-limited: 5/hour) |
| GET | `/api/relance/response` | None | Handle relance OUI/NON click-through |
| GET | `/api/logout` | Session | Destroy session |

## Commands

```sh
npm run dev     # ts-node-dev --respawn --transpile-only src/index.ts
npm run build   # tsc (outputs to dist/)
npm start       # node dist/index.js
npm run lint    # oxlint
```

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
MYSQL_USER=root
MYSQL_DATABASE=sales_service
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIRECT_URI=http://localhost:4000/auth/callback
APP_BASE_URL=http://localhost:4000
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Disciplina <epitechdisciplina.dev@gmail.com>
RELANCE_HMAC_SECRET=change-this-relance-secret
GOOGLE_STATE_SECRET=change-this-google-state-secret
```

All vars are validated by `back/src/config/env.ts` using Zod — the server exits immediately if anything is missing or invalid.

### Insecure default warnings

In dev, `JWT_SECRET` and `SESSION_SECRET` warn if set to known insecure values. In production, the server exits.

## Databases

### MySQL (`sales_service`)
- Tables: `sale_persons`, `companies`, `users`
- Init: `database/mysql/mysql-init.sql`
- Connection pool via `mysql2/promise` (10 connections)

### MongoDB (`human_ressources`)
- Collections: `candidates`, `jobs` (with `$jsonSchema` validation)
- Init: `database/mongodb/mongo-init.js`
- Mongoose with `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`

## Auth flow

1. **Register**: `POST /api/auth/register` → bcrypt hash → insert user
2. **Login**: `POST /api/auth/login` → verify password → return JWT (24h expiry)
3. **REST auth**: `Authorization: Bearer <token>` → `authenticate()` middleware attaches `req.user`
4. **GraphQL auth**: Same header → `context.ts` verifies JWT → attaches `user` to Apollo context
5. **Google OAuth**: `POST /api/auth/google/uri` → HMAC-signed state → popup auth → `POST /api/auth/google/token` → tokens stored in MySQL `users` table

## Key dependencies

- `apollo-server-express` ^3.13 — GraphQL
- `express` ^4.18 — HTTP framework
- `mysql2` ^3.9 — MySQL driver
- `mongoose` ^9.5 — MongoDB ODM
- `jsonwebtoken` ^9.0 — JWT auth
- `bcrypt` ^6.0 — Password hashing
- `googleapis` ^171 — Google APIs (Drive, Calendar, Gmail)
- `nodemailer` ^6.9 — SMTP email
- `pdfkit` ^0.18 — PDF generation
- `zod` ^4.4 — Env validation
- `pino` ^10.3 — Logging
- `express-rate-limit` ^8.5 — Rate limiting
- `express-session` ^1.19 — Session middleware
- `oxlint` ^0.64 — Linter (Rust-based)

## Known quirks

- No test suite or CI configured
- 3 separate Apollo Servers instead of one unified gateway — cross-entity GraphQL queries not possible
- CORS origins hardcoded to `localhost:3000` and `localhost:5173` in `index.ts`
- Session cookies lack `secure`, `httpOnly`, `sameSite` flags
- Error handler sends `err.message` directly to client (may leak internals)
- `flattenObject` helper duplicated in both `CandidateRepository` and `JobRepository`
- GraphQL resolver contexts use `any` throughout
- No dependency injection — services manually instantiate repositories
- Backend Dockerfile runs `npm run dev` as CMD (not production build)
