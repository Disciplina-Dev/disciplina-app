# How to Contribute to the Backend

This guide connects architecture, conventions, and testing into one reference for backend contributors. It covers adding features, refactoring, and fixing bugs. Read this alongside [README.md](./README.md), [CONVENTION.md](./CONVENTION.md), and [HOWTOTEST.md](./HOWTOTEST.md).

## Backend Architecture at a Glance

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

| Layer | Folder | Responsibility |
|---|---|---|
| Entry point | `src/index.ts` | Bootstrap Express, mount routes, connect DBs |
| Config | `src/config/` | Env validation — server exits on bad vars |
| REST API | `src/rest/<module>/` | `route.ts` + `controller.ts` per feature |
| GraphQL API | `src/graphql/<module>/` | `typeDefs.ts` + `resolver.ts` per domain |
| Services | `src/services/` | All business logic, class-based |
| Repositories | `src/repositories/` | Data access only, no business logic |
| Mappers | `src/services/mappers/` | Pure fn: snake_case DB ↔ camelCase domain |
| External | `src/external/` | Third-party integrations, crypto, logger |
| Types | `src/types/` | Shared TypeScript interfaces |
| DB schemas | `src/db/` | Mongoose schemas + MySQL/Mongo connections |

### When to create a new folder

- **REST**: add `src/rest/<new-module>/route.ts` + `controller.ts`
- **GraphQL**: add `src/graphql/<new-domain>/typeDefs.ts` + `resolver.ts`
- **New third-party integration**: add `src/external/<vendor>/` with a `types.ts`
- **None of the above**: discuss with the team before creating a new top-level folder under `src/`

## How to Add a New Feature

1. **Identify the layer** — HTTP? → REST or GraphQL. Pure logic? → Service. Data? → Repository. Third-party? → External.

2. **Scaffold the files** following naming conventions from [CONVENTION.md](./CONVENTION.md):
   - REST: `src/rest/<module>/route.ts` + `controller.ts`
   - GraphQL: `src/graphql/<module>/typeDefs.ts` + `resolver.ts`
   - Service: `src/services/<Name>Service.ts` (PascalCase)
   - Repository: `src/repositories/<db>/<Name>Repository.ts`
   - Types: `src/types/<name>.types.ts`

3. **Wire into `index.ts`** — mount new routers or Apollo endpoints there.

4. **Follow exports** — named exports everywhere; default export only for the MySQL pool.

5. **Auth guard** — for protected GraphQL resolvers, call `authGuard(context.user, [Role.X])` as the first line. For REST, apply `authenticate` middleware in `route.ts`.

6. **Error handling** — services throw `new Error('message')`, controllers wrap in `try/catch` and return `res.status(400).json({ error: error.message })`.

7. **Logging** — see [Logging](#logging) section below for detailed patterns.

8. **Write tests** — follow [HOWTOTEST.md](./HOWTOTEST.md) — component test next to the feature under `__tests__/`.

### Example — Adding a "Notes" REST feature

Suppose you need `POST /api/notes` and `GET /api/notes` for internal recruiter notes.

Files to create:
```
src/
  types/
    note.types.ts          ← domain type: Note { id, content, authorId, createdAt }
  repositories/
    mysql/
      NoteRepository.ts    ← findAll(), create()
  services/
    NotesService.ts        ← business logic, calls NoteRepository
  rest/
    notes/
      route.ts             ← mounts GET + POST, applies authenticate middleware
      controller.ts        ← getNotes(), createNote() handlers
```

`src/rest/notes/route.ts`:
```ts
import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getNotes, createNote } from './controller';

export const router: Router = express.Router();
router.get('/', authenticate, getNotes);
router.post('/', express.json(), authenticate, createNote);
```

`src/rest/notes/controller.ts`:
```ts
import { Response } from 'express';
import { AuthRequest } from '../../types/user.types';
import { NotesService } from '../../services/NotesService';

const notesService = new NotesService();

export async function getNotes(req: AuthRequest, res: Response): Promise<void> {
    try {
        const notes = await notesService.findAll();
        res.json(notes);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function createNote(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { content } = req.body;
        const note = await notesService.create({ content, authorId: req.user!.id });
        res.json(note);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}
```

Wire in `src/index.ts`:
```ts
import { router as notesRouter } from './rest/notes/route';
app.use('/api/notes', notesRouter);
```

Then write the component test at `src/rest/notes/__tests__/notes.test.ts` — see [HOWTOTEST.md](./HOWTOTEST.md) for the AAAC pattern.

## How to Refactor Properly

- Never change behavior and structure in the same commit.
- Move code first (copy → verify tests pass → delete old).
- Fix convention violations listed in [CONVENTION.md](./CONVENTION.md) under "Convention violations" one at a time; reference the violation number in the commit message.
- Keep mappers pure: no I/O, no side effects.
- When extracting to `external/`: callers import the module file path directly — no barrel under `external/google/`.
- Run `npm run lint` and `npm run format:check` before opening a PR.

## How to Fix a Bug

1. **Reproduce** — write a failing component test first (or confirm an existing test fails).

2. **Locate the layer** — use the architecture map: wrong response shape → mapper or resolver; wrong DB write → repository; wrong business rule → service.

3. **Fix the smallest scope** — do not refactor while fixing.

4. **Check error handling** — ensure the fix uses the correct HTTP status code and returns `{ error: "message" }`.

5. **Run** `npm test` with Docker databases running.

6. **Commit** — fix and test in the same commit.

## Logging

Every log must use the `logger` singleton from `external/logger/`. **Never use `console.log`, `console.warn`, or `console.error` in `src/`** (exception: `config/env.ts` startup validation).

### Basic usage

```ts
import { logger } from '../../external/logger';

// ✅ Correct — always use object syntax with context + message
logger.info({ userId: 123 }, 'User logged in');
logger.warn({ path: '/uploads/file.pdf' }, 'File not found');
logger.error({ err: error, email }, 'Login failed');

// ✅ Simple info (no expensive computation)
logger.debug('Starting scraper');

// ❌ Wrong — bare error (loses serialization)
logger.error(error);

// ❌ Wrong — console calls
console.error(error);
console.log(data);
```

### Log levels

Default behavior — set via `LOG_LEVEL` env var:

| Environment | Default | Use case |
|-------------|---------|----------|
| `production` | `info` | Only significant events — minimal log volume |
| `development` / `test` | `debug` | Verbose diagnostics during development |

**Choose the right level:**

- **`fatal`** — process about to crash (e.g., uncaught exception after logging)
- **`error`** — operation failed, user/system impact, needs investigation
- **`warn`** — degraded behavior but recoverable (e.g., retry, fallback)
- **`info`** — milestone events (user actions, startup, significant state changes)
- **`debug`** — diagnostic info for developers (values, state snapshots, non-critical failures)
- **`trace`** — extremely granular (loop iterations, query details, function entry/exit)

**Example escalation:**

```ts
try {
    const user = await userService.findById(id);
} catch (error) {
    logger.error({ err: error, userId: id }, 'findById failed');  // error level
    // Handle gracefully...
    logger.warn({ userId: id }, 'User lookup failed, using cache');  // warn level
}
```

### PII and sensitive data

The logger automatically redacts these fields across all logs:

```
passwords, tokens, API keys, emails, phone numbers, SSNs,
Authorization headers, cookies, etc.
```

They are masked as `[REDACTED]` in the output. **You do not need to manually redact** — the logger handles it.

```ts
// Safe — email will be redacted even though it's in the object
logger.error({ err, email: user.email }, 'Failed to send email');

// Output:
// {"err": {...}, "email": "[REDACTED]", ...}
```

### Error logging

Always use the `{ err: error }` pattern so error serialization works correctly:

```ts
try {
    await database.query(sql);
} catch (error) {
    // ✅ Correct — err will serialize with stack trace at error level
    logger.error({ err: error }, 'Database query failed');

    // ❌ Wrong — bare error bypasses serialization
    logger.error(error);

    throw error;  // Re-throw after logging
}
```

**Stack trace behavior:**

- At `error`/`fatal` level: stack trace is included in `error.stack_trace`
- At `warn` and below: stack trace is omitted to save log volume

### Canonical field names (OTel Semantic Conventions)

When logging structured data, use these standard field names so logs are machine-parseable:

```ts
// HTTP
logger.info({ 'http.method': 'POST', 'http.url': '/api/users' }, 'Request received');

// Identity
logger.info({ 'user.id': 123 }, 'User action');
logger.info({ 'company.id': 456 }, 'Company context');

// Errors
logger.error({ err, 'error.message': e.message }, 'Operation failed');
```

The HTTP middleware automatically logs these for all requests — you don't need to add them manually.

### Request correlation

All logs within a single HTTP request share the same `http.request_id` (UUID), making it easy to trace a user's action through the entire stack:

```
GET /api/users → [http.request_id: 550e8400-...]
  ├─ UserController.list()
  ├─ UserService.findAll()
  ├─ UserRepository.findAll()
  └─ [All logs above will have http.request_id: 550e8400-...]
POST /api/users → [http.request_id: 6ba7b810-...]  (different request)
```

### Example — complete flow

```ts
// src/rest/users/controller.ts
import { logger } from '../../external/logger';

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
        logger.debug({ userId: req.user?.id }, 'Fetching user list');
        const users = await userService.findAll();
        logger.info({ count: users.length }, 'User list fetched');
        res.json(users);
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch user list');
        res.status(500).json({ error: error.message });
    }
}
```

**Log output (development):**

```
[DEBUG] Fetching user list {"userId": 123, "http.request_id": "550e8400-...", ...}
[INFO] User list fetched {"count": 42, "http.request_id": "550e8400-...", ...}
```

**Log output (production, ndjson):**

```json
{"level":"debug","userId":123,"http.request_id":"550e8400-...","service":"disciplina-api","env":"production","version":"1.0.0"}
{"level":"info","count":42,"http.request_id":"550e8400-...","service":"disciplina-api","env":"production","version":"1.0.0"}
```

## CI

Every push and pull request triggers the GitHub Actions workflow (`.github/workflows/ci.yml`). It runs the full backend test suite inside Docker using ephemeral databases (no persistent volumes). Failing tests appear as inline annotations on the PR diff — no need to dig through raw logs.

To reproduce CI locally from the project root:

```sh
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit
```

Exit code 0 = all tests pass. Non-zero = at least one test failed.

## Development Checklist

- [ ] `docker compose up -d sql-db nosql-db` before running tests locally
- [ ] `npm run lint` — zero errors
- [ ] `npm run format:check` — passes
- [ ] `npm test` — all green
- [ ] Named exports only (no `export default`, except the MySQL pool)
- [ ] No `console.*` — use `logger` from `external/logger/`
- [ ] No `zod` or schema libraries — hand-rolled validator in `config/env.ts`
- [ ] New third-party code goes in `external/<vendor>/`
