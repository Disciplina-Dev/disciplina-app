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

## File naming conventions

| Layer | Convention | Examples |
|-------|-----------|----------|
| Directories | `kebab-case` | `rest/auth/`, `db/mongo/schemas/` |
| Route files | `route.ts` | Always named `route.ts` |
| Controller files | `controller.ts` | Always named `controller.ts` |
| GraphQL types | `typeDefs.ts` | Always named `typeDefs.ts` |
| GraphQL resolvers | `resolver.ts` (or `resolvers.ts`) | Candidate: `resolver.ts`, Company: `resolvers.ts` |
| Mongoose schemas | `kebab-case.schema.ts` | `candidate.schema.ts`, `job.schema.ts` |
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

| Context | Convention | Example |
|---------|-----------|---------|
| DB rows (raw) | snake_case | `sale_person_id`, `oauth_token`, `refresh_token` |
| Domain types | camelCase | `salePersonID`, `oauthToken`, `refreshToken` |
| MongoDB fields | snake_case | `full_name`, `tp_type`, `training_site` |

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
- Tables: `sale_persons`, `companies`, `users`
- JSON stored as stringified text (e.g., `sectors` in `users` table)

### MongoDB

- Mongoose ODM with explicit `collection` names
- Schemas with `_id: false` on subdocuments
- `flattenObject()` helper converts nested objects to dot-notation for `$set` updates
- Collections: `candidates`, `jobs`

## Authentication & authorization

### JWT flow

1. Login → `UserService.login()` verifies bcrypt hash → signs JWT with `{ id, email, role }`, 24h expiry
2. Client sends `Authorization: Bearer <token>` header
3. REST: `authenticate()` middleware verifies JWT, attaches `req.user`
4. GraphQL: `context.ts` extracts JWT, attaches to Apollo context

### Role-based access

- Three roles: `ADMIN`, `COMMERCIAL`, `RH` (or `ENTREPRISE` in some frontend code)
- `ADMIN` role bypasses all role checks
- GraphQL: `authGuard(context.user, [Role.XXX])` at resolver level
- REST: inline checks like `if (req.user?.role !== 'ADMIN')`

### Google OAuth

1. `POST /api/auth/google/uri` → HMAC-signs user ID into `state` param → returns Google OAuth URL
2. User authorizes in popup → Google redirects to frontend with `code` + `state`
3. `POST /api/auth/google/token` → verifies HMAC signature → exchanges `code` for tokens → stores in MySQL `users` table
4. Admin can pass `userId` in body to generate URI bound to another user

## Code style

### async/await

- Always use `async/await` over raw promises
- No `.then()` / `.catch()` chains

### TypeScript

- `strict: true` in tsconfig
- Define interfaces/types for all data shapes
- DB row types (snake_case) vs domain types (camelCase) are separate
- `AuthRequest` extends Express `Request` with `user?: any`

### Linter (oxlint)

- Config: `.oxlintrc.json`
- Run: `npm run lint`
- Categories: correctness (error), suspicious (warn), perf (warn)
- Plugin: `import`

## Environment & configuration

- Two `.env` files loaded at startup (root `../.env` + `back/.env`)
- All vars validated by Zod in `config/env.ts`
- Server `exit(1)` on invalid/missing vars
- Exported as `export const env = data` (typed object)

## Known quirks

- No test suite or CI
- 3 separate Apollo Servers — no cross-entity GraphQL queries
- CORS origins hardcoded to localhost
- Session cookies without `secure`/`httpOnly`/`sameSite`
- Error messages leaked to client via `error.message`
- `flattenObject` duplicated in `CandidateRepository` and `JobRepository`
- Widespread `any` types in GraphQL context and middleware
- No dependency injection — services use `new Repository()`
- Docker CMD runs `npm run dev` (ts-node-dev) instead of production build
- Company resolver file is `resolvers.ts` (plural), others are `resolver.ts` (singular) — inconsistency
