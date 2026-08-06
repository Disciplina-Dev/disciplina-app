# Backend Architecture & Conventions

## Architecture overview

```
┌────────────────────────────────────────────────────┐
│                   index.ts                          │
│  Express app bootstrap + middleware + route mount   │
└────────┬──────────────┬────────────────┬────────────┘
         │              │                │
    ┌────▼────┐   ┌────▼────┐    ┌──────▼──────┐
    │  REST   │   │ GraphQL │    │ Middleware   │
    │ routes  │   │ servers │    │ auth, errors │
    └────┬────┘   └────┬────┘    │ rate-limit   │
         │              │        └─────────────┘
    ┌────▼────┐   ┌────▼────┐
    │controllers│  │resolvers│
    └────┬────┘   └────┬────┘
         │              │
    ┌────▼──────────────▼────┐
    │      Services          │
    │  (business logic)      │
    └────┬──────────────┬────┘
         │              │
    ┌────▼────┐    ┌────▼────┐
    │Repos    │    │Repos    │
    │(MySQL)  │    │(Mongo)  │
    └────┬────┘    └────┬────┘
         │              │
    ┌────▼────┐    ┌────▼────┐
    │mysql2/  │    │Mongoose │
    │promise  │    │         │
    └─────────┘    └─────────┘
```

## Layer conventions

### 1. REST modules (`src/rest/<module>/`)

Each REST feature is a self-contained directory with:

```
rest/<module>/
  route.ts       — Express Router definition
  controller.ts  — Request handler functions
```

**Route file** — named export `router`:

```ts
export const router: Router = express.Router();
router.post('/endpoint', express.json(), authenticate, handler);
```

- Always use `express.json()` middleware per-route or per-router
- Auth-protected routes use `authenticate` middleware from `rest/middleware/auth.ts`
- Always export as `export const router: Router`

**Multi-route modules:** When a module needs two sets of routes (e.g., authenticated endpoints + public webhooks), create a second route file named `<feature>.route.ts` alongside `route.ts`. Example: `classmarker/webhook.route.ts` for public webhook handlers, `classmarker/route.ts` for authenticated endpoints. Both are mounted from `index.ts`.

**Controller file** — named exports, async functions:

```ts
export async function handler(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { param } = req.body;
        // logic ...
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}
```

- Every controller wraps logic in `try/catch`
- Return type is always `Promise<void>` (Express handlers don't return the response)
- Use `res.json()` for success, `res.status(code).json(...)` for errors
- After `res.status(code).json(...)`, always `return` to stop execution

### 2. GraphQL modules (`src/graphql/<module>/`)

```
graphql/<module>/
  typeDefs.ts  — GraphQL schema (gql template literal)
  resolver.ts  — Resolver map (or resolvers.ts for company)
```

**typeDefs** — named export:

```ts
export const typeDefs = gql`
    type Query { ... }
    type Mutation { ... }
`;
```

**resolvers** — named export:

```ts
export const resolvers = {
    Query: { ... },
    Mutation: { ... },
};
```

- Each resolver: `async (_: unknown, args, context: any) => { ... }`
- First param `_` is unused parent
- Auth guard: call `authGuard(context.user, [Role.XXX])` at the top of protected resolvers

**Combining modules onto one Apollo server:** a single Apollo server can serve more than one
domain module. `graphql/server.ts` merges `graphql/company/`, `graphql/todo/` and the shared `User`
typeDefs onto `/api/graphql/companies` (both `typeDefs` arrays and `Query`/`Mutation` resolver maps).
Prefer merging over a new Apollo server when the module's data lives in the same database and is
naturally scoped to an existing domain.

> This section used to argue against ever adding a fourth server, and described `needsAnalysis` as
> merged into companies. Both are outdated: needs-analysis moved to MongoDB and now runs as its own
> `NeedsAnalysisAPI` on `/api/graphql/needs-analysis` — the merge rule above applies per-database,
> and needs-analysis no longer shares MySQL with companies.

**The four servers** (`index.ts:142-152`):

| Path | Server | Modules merged | DB |
|------|--------|----------------|-----|
| `/api/graphql/companies` | `CompanyAPI` | `company` + `todo` + `User` | MySQL |
| `/api/graphql/candidates` | `CandidateAPI` | `candidate` | MongoDB |
| `/api/graphql/offers` | `OfferAPI` | `offers` | MongoDB |
| `/api/graphql/needs-analysis` | `NeedsAnalysisAPI` | `needsAnalysis` + `User` | MongoDB |

Note: `changePassword` (a user mutation) currently lives in the `todo` module — a historical quirk,
not a pattern to copy.

### 3. Services (`src/services/`)

- Class-based, instantiate their repository in the constructor
- Business logic and validation live here
- Throw `new Error('message')` for validation failures

```ts
export class CompaniesService {
    private repository: CompanyRepository;
    constructor() {
        this.repository = new CompanyRepository();
    }
}
```

- Repository may also be initialized as a field: `private repository = new CompanyRepository()` — equivalent to the constructor form and also acceptable
- When a service has no repository dependency (e.g., PDF generation), it may be a class with static methods only. Example: `PdfService.generateCandidatePdf()`

### 4. Repositories (`src/repositories/`)

- Class-based data access layer
- MySQL: raw SQL via `query<T>()` helper from `db/mysql/connection.ts`
- MongoDB: Mongoose model calls

```ts
export class CompanyRepository {
    async findAll(): Promise<CompaniesRow[]> {
        return query<CompaniesRow[]>('SELECT * FROM companies');
    }
}
```

### 5. Mappers (`src/services/mappers/`)

- Pure functions (no classes)
- Transform between DB row shape (snake_case) and domain types (camelCase)
- Named exports: `toUser()`, `toCompanies()`, `toSalePerson()`

### 6. External integrations (`src/external/`)

Any code that talks to a third-party API, performs cryptography, or wraps a cross-cutting infrastructure concern lives under `src/external/`. Business code (services, controllers, resolvers) imports from `external/` — it never reaches into `googleapis`, `node:crypto`, or `pino` directly.

```
external/
  google/
    oauth-client.ts   GoogleOAuthClient (auth URL, code exchange, credentialed-client + refresh hook) + `googleOAuth` singleton
    drive.service.ts  GoogleDriveService — Drive API wrapper
    gmail.service.ts  GoogleGmailService — Gmail API wrapper (uses mime.builder, sendEmail + createDraft)
    mime.builder.ts   buildRawMessage(options) — pure MIME assembly
    types.ts          GoogleTokens, GoogleTokenRefreshHandler, DriveFile, SendEmailOptions
  crypto/
    hmac.service.ts   HmacService class + `hmac` singleton (sign/verify)
    signers.ts        Domain helpers: signRelanceUrl/verifyRelanceUrl, signGoogleState/verifyGoogleState
    index.ts          Barrel
  logger/
    logger.ts         pino instance (pretty in dev)
    index.ts          Barrel
  insee/
    sirene.service.ts SireneService — INSEE Sirene API v3.11 client
    types.ts          SireneEtablissement, SireneCriterion, SireneListResult, SireneAdresse, etc.
  filiz/
    auth-client.ts    FilizAuthClient — OAuth2 client-credentials token fetch/cache (via FilizRepository)
    filiz.service.ts  FilizService — wraps the Filiz degree/class APIs
    type.ts           FilizToken, FilizDegree, FilizClass
```

### `insee/` — INSEE Sirene integration

- `SireneService.checkSiret(siret: string): Promise<SireneEtablissement>` — validates a 14-digit
  SIRET against `GET /api-sirene/3.11/siret/{siret}`. Throws `'SIRET not found'` (404),
  `'Invalid INSEE API key'` (401), or `'Rate limit exceeded'` (429).
- `SireneService.searchEstablishments(criteria: SireneCriterion[], offset?: number): Promise<SireneListResult>`
  — multi-criteria search (`siren`, `libelleCommuneEtablissement`, `activitePrincipaleUniteLegale`
  are the only accepted `paramName`s), paginates with a 140ms delay between INSEE requests, filters
  to active establishments (`etatAdministratif !== 'F'`), caps results at 20.
- Env: `INSEE_API_KEY` (optional — `external/insee/` is the only place it should be read).
- Used by `CompaniesService.create()` (SIRET validation) and `rest/sourcing/controller.ts`
  (search-by-SIREN, multicriteria search).

### `filiz/` — Filiz ERP integration

- `FilizAuthClient` — implements OAuth2 client-credentials flow against
  `${FILIZ_AUTH_URI}/oauth/token`, caching the resulting token in the `filiz` MySQL table via
  `FilizRepository` (`getToken`, `insertToken`, `deleteTokens`).
- `FilizService.getDegreesInfos()` / `getClassInfos(degreeId)` — wrap
  `${FILIZ_BASE_URI}/api/degree` and `${FILIZ_BASE_URI}/api/class`.
- Env: `FILIZ_CLIENT_ID`, `FILIZ_CLIENT_SECRET`, `FILIZ_AUDIENCE`, `FILIZ_BASE_URI`,
  `FILIZ_AUTH_URI` (all required; CI has fallback values in `config/env.ts`).
- Wired: `FilizService` is exposed through `rest/filiz/controller.ts` and the router is mounted on `/api/filiz` (`index.ts:31,124`).

**Rules:**
- Callers import from the specific module file (`external/google/oauth-client`, `external/google/gmail.service`, etc.). No barrels under `external/google/` — they hide where the code lives. (`crypto/` and `logger/` keep their barrels because the public surface is genuinely one bag of small helpers.)
- Type and interface declarations for an `external/<integration>/` module always live in `<integration>/types.ts` — not next to the class that uses them.
- Service classes are prefixed with `Google` (e.g. `GoogleDriveService`, `GoogleGmailService`, `GoogleOAuthClient`) to make the integration boundary obvious at call sites.
- Google OAuth2 clients are created **only** via `googleOAuth.forCredentials(creds, onRefresh?)` — never `new google.auth.OAuth2(...)` outside `oauth-client.ts`. The redirect URI lives in `env.GOOGLE_REDIRECT_URI`, not in source.
- When a Google API call may refresh tokens, callers pass a refresh handler that persists the new tokens via `userService.updateGoogleTokens`. The convention helper at the top of each call site is `persistRefreshedTokens(userId)`.
- Domain crypto helpers (relance URL signer, OAuth state signer) live in `external/crypto/signers.ts`, not next to the feature that uses them — this keeps every secret-handling routine in one auditable place.
- The logger is a singleton; never instantiate `pino()` outside `external/logger/`.

## File naming conventions

| Layer | Convention | Examples |
|-------|-----------|----------|
| Directories | `kebab-case` | `rest/auth/`, `db/mongo/schemas/` |
| Route files | `route.ts` | Always named `route.ts` |
| Controller files | `controller.ts` | Always named `controller.ts` |
| GraphQL types | `typeDefs.ts` | Always named `typeDefs.ts` |
| GraphQL resolvers | `resolver.ts` (or `resolvers.ts`) | Candidate: `resolver.ts`, Company: `resolvers.ts` |
| Mongoose schemas | `kebab-case.schema.ts` | `candidate.schema.ts`, `offer.schema.ts` |
| Repository files | `PascalCase.ts` | `UserRepository.ts`, `CompanyRepository.ts` |
| Service files | `PascalCase.ts` | `CompaniesService.ts`, `CandidateService.ts` |
| Type files | `kebab-case.types.ts` | `user.types.ts`, `candidate.types.ts` |
| DB row files | `kebab-case.ts` | `db-rows.types.ts` |
| Utility files | `kebab-case.ts` | `hmac.ts`, `logger.ts` |

## Export conventions

- **Named exports** for almost everything: routes, controllers, services, resolvers, typeDefs, types
- **Default export** only for MySQL connection pool in `db/mysql/connection.ts`

```ts
// ✅ Correct
export class CompaniesService { ... }
export async function login(req, res) { ... }
export const router: Router = Router();
export const typeDefs = gql`...`;
export const resolvers = { Query: { ... } };

// ❌ Avoid default exports (except MySQL pool)
export default class ...  // ❌
export default function ...  // ❌
```

## Naming conventions

### TypeScript

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UserService`, `CompanyRepository` |
| Interfaces | PascalCase | `User`, `Companies`, `AuthRequest` |
| Types | PascalCase | `UserRow`, `CompaniesRow` |
| Enums | PascalCase | `Role`, `CandidateStatus` |
| Functions | camelCase | `toUser()`, `login()`, `findAll()` |
| Methods | camelCase | `findByEmail()`, `updateTokens()` |
| Variables | camelCase | `token`, `user`, `oauth2Client` |
| Constants | UPPER_SNAKE_CASE | `SALT_ROUNDS`, `CALLBACK_URL` |
| Files/Dirs | kebab-case | `user.types.ts`, `rest/auth/` |

### Database fields

**The API is always camelCase. Where the conversion happens differs per database.**

| Context | Convention | Example | File |
|---------|-----------|---------|------|
| MySQL rows (raw) | snake_case | `user_id`, `oauth_token` | `types/db-rows.types.ts` |
| MySQL domain types | camelCase — converted **at the repository** | `userID`, `oauthToken` | `types/company.types.ts`, `user.types.ts` |
| MongoDB documents | snake_case | `full_name`, `tp_types` | `db/mongo/schemas/` |
| MongoDB domain types | snake_case — **mirror the document**, no conversion here | `full_name`, `tp_types`, `training_site` | `types/candidate.types.ts`, `needsAnalysisNoSql.types.ts` |
| GraphQL schema & responses (both DBs) | camelCase — converted **at the resolver** | `fullName`, `tpTypes` | `graphql/*/typeDefs.ts` |

The two paths differ by **where** snake_case turns into camelCase:

- **MySQL:** the mapper runs early — `UserRepository` returns a `camelCase` domain type, and the
  resolver passes it through.
- **MongoDB:** the mapper runs late — the domain type mirrors the document
  (`candidate.types.ts` has 98 snake_case fields, deliberately), and `candidateToGql()`
  (`services/mappers/candidate.mapper.ts:32`) converts to camelCase at the resolver boundary
  (`graphql/candidate/resolver.ts:116`). Generic `snakeToCamelCase` / `camelToSnakeCase` helpers
  live in the same file.

So: do **not** "fix" `candidate.types.ts` to camelCase — it mirrors the document by design, and the
conversion is the resolver's job. Conversely, a MySQL domain type must never surface `snake_case`.

> These rows previously read "Domain types | camelCase" and "MongoDB fields | snake_case" as two
> unqualified rules, which contradicted each other for Mongo domain types. Clarified 2026-07-17.

## Error handling patterns

### REST controllers

```ts
try {
    const result = await someService.method();
    res.json(result);
} catch (error: any) {
    res.status(400).json({ error: error.message });
}
```

- Use appropriate HTTP status codes: 400 (validation), 401 (auth), 403 (permission), 404 (not found), 500 (server error)
- Return `{ error: "message" }` as JSON body

### Services

- Throw `new Error('Human-readable message')` for validation errors
- No custom error classes — plain `Error` throughout

### Global error handler (`rest/middleware/errorHandler.ts`)

- Catches unhandled errors from all routes
- Logs via Pino
- Returns `{ error: { code, message } }`

### GraphQL resolvers

- Auth failures: `authGuard()` throws `Error` — Apollo returns as 400-level error
- Business logic errors: throw `new Error()` directly

## Database conventions

### MySQL

- Raw SQL via `mysql2/promise` with prepared statements (`pool.execute()`)
- Connection pool with `query<T>()` helper for selects
- Manual connection handling (`getConnection()` + `conn.release()`) for create/update
- JSON stored as stringified text (e.g., `sectors` in `users` table)

#### Least-privilege account

The app connects as `disciplina_app`, never as `root`. `mysql-init.sql` narrows its grants to
`SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES` on
`disciplina.*` — `DROP` and every global privilege are withheld, so `DROP DATABASE`, `DROP TABLE`
and reads of `mysql.user` are all refused. `CREATE`/`ALTER` are granted because
`runMysqlMigrations()` evolves the schema at boot; `CREATE TEMPORARY TABLES` because the KPI
queries use CTEs that MySQL materialises.

**Convention:** any new query must work under this grant set. Two known traps — `TRUNCATE`
requires `DROP` (use `DELETE`), and a `WITH` CTE requires `CREATE TEMPORARY TABLES`. The test
suite runs under the same account, so a violation fails in CI rather than in production.

`mysql-init.sql` only runs on a fresh volume: existing databases need
`database/mysql/migrations/2026-08-06-app-user.sql` applied once, otherwise keep `MYSQL_USER=root`
in `.env`. Credentials come from `MYSQL_USER` / `MYSQL_PASSWORD`; `MYSQL_PASSWORD` is unset means
falling back to the root password (backwards compatibility, see `config/env.ts`).

### MongoDB

- Mongoose ODM with explicit `collection` names
- Schemas with `_id: false` on subdocuments
- `flattenObject()` helper converts nested objects to dot-notation for `$set` updates

For table and collection names, see [`README.md`](./README.md#databases).

### Schema migrations

`mysql-init.sql` only runs against fresh Docker volumes — production databases and existing local
dev volumes never re-run it, so new columns added there would be missing on those databases.
`db/mysql/migrations.ts` (`runMysqlMigrations()`) runs once at boot, right after
`connectMySQL()`: for each entry in the hardcoded `REQUIRED_COLUMNS` list (table, column,
definition), it checks `INFORMATION_SCHEMA.COLUMNS` and runs `ALTER TABLE ... ADD COLUMN` if the
column doesn't exist yet, logging each addition via `logger.info`.

**Convention:** when adding a new column to an existing table, add it to **both**
`mysql-init.sql` (fresh installs) **and** `REQUIRED_COLUMNS` in `db/mysql/migrations.ts` (existing
installs). Table/column identifiers in `REQUIRED_COLUMNS` are hardcoded constants, never
user input, so the string-built `ALTER TABLE` is safe.

The same applies to whole tables via `REQUIRED_TABLES` (same file): a new table goes in **both**
`mysql-init.sql` and `REQUIRED_TABLES`, otherwise fresh volumes and existing databases drift apart.
`users`, `roles`, `permissions`, `filiz`, `companies` and `company_history` live only in
`mysql-init.sql` — they predate the mechanism and are handled by ad-hoc migrations.

## Authentication & authorization

### Role-based access

- Four roles: `ADMIN`, `RESPONSABLE`, `COMMERCIAL`, `RH` (or `ENTREPRISE` in some frontend code)
- `ADMIN` role bypasses all role checks
- GraphQL: `authGuard(context.user, [Role.XXX])` at resolver level (call at the very first line of each protected resolver)
- REST: inline checks like `if (req.user?.role !== 'ADMIN')` before executing protected logic, or
  the `requireRoles(...roles)` middleware from `rest/middleware/roleGuard.ts` chained after
  `authenticate` (e.g. `[authenticate, requireRoles('ADMIN', 'RESPONSABLE')]` — see
  `rest/kpi/route.ts`)

### Google OAuth code patterns

- Google OAuth2 clients are created **only** via `googleOAuth.forCredentials(creds, onRefresh?)` — never `new google.auth.OAuth2(...)` outside `oauth-client.ts`. The redirect URI lives in `env.GOOGLE_REDIRECT_URI`, not in source.
- When a Google API call may refresh tokens, callers pass a refresh handler that persists the new tokens via `userService.updateGoogleTokens`. The convention helper at the top of each call site is `persistRefreshedTokens(userId)`.
- Domain crypto helpers (relance URL signer, OAuth state signer) live in `external/crypto/signers.ts`, not next to the feature that uses them — this keeps every secret-handling routine in one auditable place.

For the complete JWT and Google OAuth flow (user-facing runtime narrative), see [`README.md`](./README.md#auth-flow).

## Code style

### async/await

- Always use `async/await` over raw promises
- No `.then()` / `.catch()` chains

### TypeScript

- `strict: true` in tsconfig
- Define interfaces/types for all data shapes
- DB row types (snake_case) vs domain types (camelCase) are separate
- `AuthRequest` extends Express `Request` with `user?: any`

### Logger

**Never use `console.log`, `console.warn`, or `console.error` inside `src/`** — only in `config/env.ts` during startup validation.

Always use the `logger` singleton from `external/logger/`. The logger is production-grade Pino with:

**Configuration:**

| Option | Value |
|--------|-------|
| **Log level** | Controlled via `LOG_LEVEL` env var (see below) |
| **Base fields** | Every log includes `service: 'disciplina-api'`, `env`, `version` |
| **Transport** | Pretty-printed colorized output in dev; raw JSON (ndjson) to stdout in production |
| **PII redaction** | Automatic masking: `*.password`, `*.token`, `*.email`, `*.apiKey`, `req.headers.authorization`, etc. |
| **Error serialization** | Stack traces only at `error`/`fatal` level; omitted at `warn` and below |

**Environment variables:**

```bash
# Log level (default: 'info' in production, 'debug' in development)
LOG_LEVEL=trace|debug|info|warn|error|fatal

# Node environment (default: 'development')
NODE_ENV=development|production|test
```

**Log level hierarchy:**

| Level | Value | When to use |
|-------|-------|-------------|
| `fatal` | 60 | Process is about to crash |
| `error` | 50 | Operation failed, requires investigation |
| `warn` | 40 | Degraded operation, recoverable |
| `info` | 30 | Normal significant events (default prod) |
| `debug` | 20 | Verbose diagnostic info (default dev) |
| `trace` | 10 | Extremely granular (queries, loop steps) |

**Usage patterns:**

```ts
import { logger } from '../../external/logger';

// ✅ Correct — with context object
logger.info({ userId: 123 }, 'User logged in');
logger.warn({ filePath }, 'File not found');
logger.error({ err: error }, 'Operation failed');

// ❌ Wrong — bare strings (use object syntax instead)
logger.error(error);
logger.error('message');

// ❌ Wrong — console calls
console.error(error);
console.log(data);
```

**Canonical field schema (OTel Semantic Conventions):**

When logging request-scoped data, use these standard field names:

```ts
// Request correlation (set automatically by pino-http middleware)
req.id              // UUID, unique per HTTP request
trace_id            // OTel trace ID (future use)

// HTTP (OTel Semantic Conventions)
http.method         // GET, POST, etc.
http.url            // Full path with query string
http.status_code    // Numeric response status
http.request_id     // Same as req.id

// Identity
user.id             // Authenticated user's internal ID
company.id          // Company context when applicable

// Error (OTel Semantic Conventions)
error.message       // err.message
error.stack_trace   // err.stack (error/fatal level only)

// Base (always present, added automatically)
service             // 'disciplina-api'
env                 // 'production' | 'development' | 'test'
version             // From package.json
```

**Example — REST controller:**

```ts
import { logger } from '../../external/logger';

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { email } = req.body;
        logger.debug({ email }, 'Creating user');
        const user = await userService.create(email);
        logger.info({ userId: user.id, email }, 'User created');
        res.json(user);
    } catch (error: any) {
        logger.error({ err: error, email }, 'User creation failed');
        res.status(400).json({ error: error.message });
    }
}
```

**Example — Service layer:**

```ts
export class UserService {
    async create(email: string): Promise<User> {
        const existing = await this.repository.findByEmail(email);
        if (existing) {
            logger.warn({ email }, 'Email already registered');
            throw new Error('Email already in use');
        }
        const user = await this.repository.create(email);
        logger.info({ userId: user.id }, 'User persisted to database');
        return user;
    }
}
```

**Auto-logged HTTP traffic:**

Every HTTP request/response is automatically logged by the `pino-http` middleware:

```json
// Request received:
{"level":"info","http.method":"POST","http.url":"/api/users","http.request_id":"550e8400-...","service":"disciplina-api","env":"development","version":"1.0.0"}

// Response sent (includes responseTime):
{"level":"info","http.status_code":201,"responseTime":42,"http.request_id":"550e8400-...","service":"disciplina-api","env":"development","version":"1.0.0"}
```

**Log output format:**

- **Development** (`NODE_ENV != 'production'`): Pretty-printed with colors — human-readable
- **Production**: ndjson (newline-delimited JSON) to stdout — parseable by log aggregators (Datadog, ELK, CloudWatch, etc.)

### Cryptography

- `randomUUID` from `node:crypto` may be called directly (it is not secret-handling)
- All HMAC signing, verification, and hash-based operations must go through `external/crypto/`
- Direct `import crypto from 'crypto'` for hashing is not allowed — add the operation to `external/crypto/signers.ts` instead

### Linter (oxlint)

- Config: `.oxlintrc.json`
- Run: `npm run lint`
- Categories: correctness (error), suspicious (warn), perf (warn)
- Plugin: `import`

### Pre-commit hooks

Pre-commit hooks run Prettier and basic hygiene checks on staged files at `git commit` time. See [`README.md`](./README.md#pre-commit-hooks) for setup instructions and the full list of active hooks.

### Formatter (Prettier)

- Config: `back/.prettierrc`
- Run: `npm run format` (write) or `npm run format:check` (CI check)
- Settings: 4-space indent, single quotes, trailing commas, 120 print width

## Environment & configuration

- Two `.env` files loaded at startup (root `../.env` + `back/.env`) — see [`README.md`](./README.md#environment) for complete setup
- All vars validated by a hand-rolled validator in `config/env.ts` (no schema library — `zod` was removed for security reasons). The ban holds for application code; `src/mcp/` is the sole exception, because the MCP SDK's `registerTool` only accepts a Zod raw shape. See `docs/AUDIT.md` §4.1 — the exception is currently inconsistent (three zod versions coexist).
- Exported as `export const env = data` (typed object)

## Testing

For testing conventions, patterns, and examples, see [`HOWTOTEST.md`](./HOWTOTEST.md).

## Convention violations

The following violations of this CONVENTION.md have been identified in the codebase. These are tracked for future remediation:

| # | File(s) | Violation | Severity |
|---|---------|-----------|----------|
| 1 | `rest/classmarker/route.ts`, `webhook.route.ts` | No `controller.ts` — handler logic inlined in routes | Structural |
| 2 | `rest/candidates/route.ts` | No `controller.ts` — handler logic inlined in route | Structural |
| 3 | `rest/classmarker/service.ts` | Custom `MissingCredentialsError` and `ClassMarkerApiError` — custom Error classes banned | Error handling |
| 4 | `rest/classmarker/service.ts:67` | `.catch()` chain instead of async/await | Code style |
| 5 | `rest/classmarker/service.ts:1` | Direct `import crypto from 'crypto'` for hashing — use `external/crypto/` | External boundary |
| 7 | `rest/email/controller.ts` | `userService.findById()` called outside try/catch block | Error handling |
| 8 | `rest/relance/controller.ts` | `sendRelance` and `handleResponse` missing `Promise<void>` return type | Type annotation |
| 9 | `types/candidate-templates.ts` | Filename does not follow `kebab-case.types.ts` pattern | Naming |
| 10 | `services/mappers/candidate.mapper.ts` | Mapper function names don't follow `toX()` pattern; generic utilities mixed in | Naming / Design |
| 11 | `services/CandidateService.ts` | Repository initialized as field, not in constructor | Minor deviation |
| 13 | `rest/candidates/route.ts` (×9), `rest/classmarker/webhook.route.ts` (×2), `external/yousign/yousign.service.ts` (×2), `rest/yousign/controller.ts` (×2), `rest/classmarker/route.ts`, `rest/peda/controller.ts`, `rest/mailTemplates/controller.ts`, `external/filiz/auth-client.ts` | `logger.error(err, 'message')` / `logger.error(error)` — bare error as first arg instead of `{ err: error }` | Logging |
| 14 | `services/PedaService.ts`, `MailTemplateService.ts`, `InterviewAccessService.ts`, `rest/booking/service.ts` | 8 more custom Error classes beyond #3 — `SlotUnavailableError` is even declared twice | Error handling |
| 15 | `rest/classmarker/webhook.route.ts`, `rest/candidates/route.ts` | Routes import Mongoose models directly (`CandidateModel`, `CandidateAvatarModel`), skipping both service and repository | Layering |
| 16 | `rest/booking/repository.ts`, `rest/booking/service.ts`, `rest/classmarker/service.ts` | A repository and two services live under `rest/` instead of `repositories/` and `services/` | Structural |
| 17 | `rest/mailTemplates/`, `rest/sectorSettings/`, `rest/needsAnalysis/`, `graphql/needsAnalysis/` | Directory names are camelCase, convention says kebab-case (`rest/rh-kpi/` complies) | Naming |
| 18 | `rest/middleware/webhookSignature.ts:25-34`, `mcp/auth.ts:2` | `timingSafeStringEqual` / `hmacDigest` re-implement `external/crypto/compare.ts` and `HmacService`; direct `timingSafeEqual` import | External boundary |

**Fixed and removed from this table (2026-07-17 audit):**

- ~~#6 stray `import { set } from 'mongoose'` in `CompanyRepository.ts`~~ — verified gone.
- ~~#12 `flattenObject()` duplicated in `CandidateRepository` and `JobRepository`~~ — `JobRepository` no longer exists (jobs → offers); the helper now lives only in `repositories/mongo/CandidateRepository.ts:82`. No duplication left.

> ⚠️ **Do not add "Recently fixed ✅" claims without re-verifying them.** This section previously certified that *all* `console.*` calls in `src/` had been replaced with `logger` (dated June 8, 2026). That was false: **10 remain in production code** (`rest/classmarker/webhook.route.ts`, lines 90-185 — where `logger` is already imported on line 2) plus 3 debug leftovers in `graphql/offers/__tests__/query.test.ts`. A doc that certifies a fix that never happened is worse than no doc: it stops the next person from looking. Entry #13 had the same problem — it listed 3 sites when there were 19.

---
