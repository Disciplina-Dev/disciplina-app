# HOWTOTEST.md — Backend component testing

This guide is for contributors writing the first tests in `back/`. It is **opinionated** and **project-specific**. The goal is for any backend dev to be able to drop a new test file into the right place without rediscovering conventions every time.

31 component tests for GraphQL candidates (`src/graphql/candidate/__tests__/` — `query.test.ts` ×17, `mutation.test.ts` ×9, `history.test.ts` ×5) are already in place as a reference; the repo holds 26 test files in total. Drop new test files next to the feature they cover. CI runs on every push via `.github/workflows/ci.yml` — requires Dockerised MySQL + MongoDB.

> **Running the tests locally.** They expect MySQL on `localhost:3307` (`docker-compose.test.yml` publishes `3307:3306`) while `.env` sets `MYSQL_PORT=5001` for the dev stack. `env.ts` forces `MYSQL_HOST=localhost` when `NODE_ENV=test` but still reads `MYSQL_PORT`, so the port has to match the test stack — start it with `docker compose -f docker-compose.test.yml up -d` and make sure `MYSQL_PORT=3307` is what the test process sees. See `docs/AUDIT.md` §1.4 ter: one variable serves three incompatible targets (3306 inside compose, 3307 for tests, 5001 from the host), which is the usual cause of a failing `npm test`.

---

## 1. Philosophy: Testing Diamond + AAAC

We prioritise **component tests** over unit tests. A component test boots the Express app, talks to it through HTTP, and uses real MySQL and real MongoDB. We only mock things that leave the service boundary — Google APIs, HMAC signers — never our own services, repositories, resolvers, or controllers.

Every test follows **AAAC**:

- **Arrange** — seed only what the test needs. Use a random suffix (`Date.now()`, UUID) on unique fields so suites never collide.
- **Act** — one `fetch()` call against the running server. No internal function calls.
- **Assert** — check three exit doors: (1) the HTTP response (status + body), (2) the persisted state by reading it back through another API call, (3) outgoing calls to mocked third parties.
- **Clear** — wipe the rows the test touched so the next test starts clean.

The original AAAC pattern lists 5 exit doors (message queues, metrics). This repo has no queues and no metrics endpoints, so those don't apply.

---

## 2. What "component" means here

The component under test is the Express app booted by `back/src/index.ts`. It exposes:

- REST routes — 21 feature modules mounted in `index.ts:107-127`, among them `/api/auth`, `/api/email/*`, `/api/relance/*`, `/api/classmarker`, `/api/webhooks`, `/api/candidates`, `/api/booking`, `/api/calendar`, `/api/match`, `/api/interview`, `/api/notifications`, `/api/kpi`, `/api/rh-kpi`, `/api/needs-analysis`, `/api/peda`, `/api/mail-templates`, `/api/sector-settings`, `/api/filiz`, `/api/sourcing`, `/api/mcp`
- Four Apollo GraphQL endpoints, all on the same Express app:
  - `POST /api/graphql/companies` — `CompanyAPI`
  - `POST /api/graphql/candidates` — `CandidateAPI`
  - `POST /api/graphql/offers` — `OfferAPI`
  - `POST /api/graphql/needs-analysis` — `NeedsAnalysisAPI`

There are no cross-entity GraphQL queries. A test posts to the endpoint that owns the entity it cares about.

**Mock boundary = `back/src/external/` only.** That is where Google (Drive, Gmail, OAuth) and crypto (HMAC signers) live. Everything in `services/`, `repositories/`, `graphql/`, `rest/`, `db/`, `config/`, `types/` is real in a component test.

---

## 3. Tooling

| Concern | Choice | Why |
|---|---|---|
| Test runner | **Vitest** | Native TS, fast cold starts, no Jest-style config |
| HTTP client | **`fetch`** (Node ≥ 18 built-in) | Black-box the API; no shared in-process state with the server |
| GraphQL client | **`fetch`** with a hand-written body | No Apollo client needed |
| Mocks | **`vi.mock()`** of `src/external/*` modules only | The boundary, never internals |

Already configured in `back/package.json` — `vitest`, `@vitest/coverage-v8` installed, `test`/`test:watch` scripts registered.

Test layout:

```
back/
  vitest.config.ts          ← loads .env.back.example, single-threaded pool
  .env.back.example         ← test env vars (MySQL localhost:5001, Mongo localhost:27017)
  src/
    graphql/candidate/__tests__/
      query.test.ts         ← candidates list, by-id, template queries
      mutation.test.ts      ← create, update, delete mutations
  test/
    setup.ts                ← boots/teardowns the server, wires .env.back.example
    helpers/
      auth.ts               ← mintToken()
      db.ts                 ← truncateMysql(), dropMongo()
```

---

## 4. Test environment

Reuse the root `docker-compose.yaml`:

```sh
docker compose up -d sql-db nosql-db
```

That gives you MySQL on `localhost:5001` and Mongo on `localhost:${MONGO_PORT:-4011}`. No separate compose file is needed.

**Env file** — `back/.env.back.example` contains test env vars pointing MySQL at `localhost:5001` / `disciplina` and MongoDB at `localhost:27017` / `human_ressources_test`. Loaded by `vitest.config.ts` before any test files run.

**Mongo URI** — `MONGO_HOST` and `MONGO_DB_NAME` env vars were added to `config/env.ts` with defaults `nosql-db` and `human_ressources`. The `connection.ts` now builds the URI from env vars instead of hardcoded values.

**Server export** — `startServer()` is exported from `index.ts` and returns the `http.Server` instance. The auto-start is guarded by `if (process.env.NODE_ENV !== 'test')`. The test setup calls it once per run and shuts it down in `afterAll`.

---

## 5. Auth helper

JWTs are minted with `env.JWT_SECRET` and carry `{ id, email, role }`. Both `rest/middleware/auth.ts` and `graphql/context.ts` decode the same shape.

`back/test/helpers/auth.ts`:

```ts
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

type Role = 'ADMIN' | 'COMMERCIAL' | 'RH';

export function mintToken(user: { id: number; email: string; role: Role }): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
}
```

Use it in tests as:

```ts
const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
```

`ADMIN` bypasses every role check (see `graphql/authGuard.ts`), so use it for the happy path and use other roles only when the test specifically asserts an authorisation outcome.

---

## 6. Clean state between tests

AAAC's "Clear" runs in `beforeEach`, globally. Per-test cleanup is fragile — global wipe is simpler and your tests stop depending on each other's leftovers.

`back/test/helpers/db.ts`:

```ts
import pool from '../../src/db/mysql/connection';
import { CandidateModel } from '../../src/db/mongo/schemas/candidate.schema';
import { OfferModel } from '../../src/db/mongo/schemas/offer.schema';

export async function truncateMysql(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('TRUNCATE TABLE companies');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
}

export async function dropMongo(): Promise<void> {
    await CandidateModel.deleteMany({});
    await OfferModel.deleteMany({});
}
```

Per-test uniqueness still matters when suites run in parallel — append `Date.now()` or a UUID to email/name fields so two suites seeding "test user" don't trip the unique index.

---

## 7. Example: REST component test

`back/src/rest/auth/__tests__/login.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { truncateMysql } from '../../../../test/helpers/db';
import { UserRepository } from '../../../repositories/mysql/UserRepository';

const BASE = 'http://localhost:4000';

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns a JWT for valid credentials and the token authorises a follow-up call', async () => {
        // Arrange — seed one user directly through the real repository
        const email = `admin-${Date.now()}@test.local`;
        const password = 'hunter2!';
        await new UserRepository().create({
            email,
            password: await bcrypt.hash(password, 10),
            role: 'ADMIN',
            // …other required fields…
        });

        // Act
        const res = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const body = await res.json();

        // Assert — HTTP response
        expect(res.status).toBe(200);
        expect(typeof body.token).toBe('string');

        // Assert — token works on a protected route (verify via public API, not the DB)
        const me = await fetch(`${BASE}/api/candidates`, {
            headers: { Authorization: `Bearer ${body.token}` },
        });
        expect(me.status).toBe(200);
    });
});
```

Notes:

- We seed via `UserRepository` because there is no public "create admin" endpoint. Seeding through a repository is fine — it's a fixture, not the system under test.
- We **verify by calling another route**, never by reading from MySQL directly. Direct DB reads tie tests to schema and rot the moment you rename a column.

---

## 8. Example: GraphQL component test

GraphQL is just an HTTP POST. No special client.

`back/src/graphql/candidate/__tests__/query.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { dropMongo, truncateMysql } from '../../../../test/helpers/db';
import { mintToken } from '../../../../test/helpers/auth';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';

const ENDPOINT = 'http://localhost:4000/api/graphql/candidates';

describe('GraphQL candidate query', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
    });

    it('returns a candidate by id for an authed admin', async () => {
        // Arrange
        const token = mintToken({ id: 1, email: 'a@test.local', role: 'ADMIN' });
        const seeded = await new CandidateRepository().create({
            identity: { full_name: `Jane ${Date.now()}`, email: 'jane@test.local', phone: '0600000000' },
            status: 'SEEKING',
            tp_type: 'AD',
        });

        // Act
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: ID!) { candidate(id: $id) { id identity { fullName email } status } }`,
                variables: { id: seeded._id },
            }),
        });
        const json = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.candidate.id).toBe(seeded._id);
        expect(json.data.candidate.identity.email).toBe('jane@test.local');
    });
});
```

Four Apollo servers, four endpoints — pick the one that owns the entity:

| Entity | Endpoint |
|---|---|
| Company / User / Todo | `POST /api/graphql/companies` |
| Candidate | `POST /api/graphql/candidates` |
| Offer / matching | `POST /api/graphql/offers` |
| Needs analysis (AB) | `POST /api/graphql/needs-analysis` |

Field names in responses are **camelCase** (`fullName`). Mongo stores them **snake_case** (`full_name`). The mappers in `src/services/mappers/` translate at the resolver boundary (`candidateToGql`) — assertions go against the camelCase form because that's what the API returns. Careful: some **inputs** still take snake_case (`identity: { full_name: ... }` in the candidate seed helpers), so input and output casing are not symmetric.

---

## 9. Mocking the `external/` boundary

Anything that leaves the service belongs in `src/external/`. That is the only place `vi.mock` is appropriate.

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';

vi.mock('../../../external/google/gmail.service', () => ({
    GoogleGmailService: vi.fn().mockImplementation(() => ({
        sendEmail: vi.fn().mockResolvedValue({ id: 'mocked-message-id' }),
    })),
}));

describe('POST /api/email/send', () => {
    it('does not call Gmail when the request is invalid', async () => {
        const res = await fetch('http://localhost:4000/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintToken({ id: 1, email: 'a@b', role: 'ADMIN' })}` },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });
});
```

Same pattern for `external/crypto/signers.ts` when a test needs a known signature (e.g. the relance HMAC, the Google OAuth state). `external/insee/` (`SireneService`) and `external/filiz/` (`FilizAuthClient`/`FilizService`) are also part of this boundary.

**Rule:** if you find yourself wanting to mock a service, repository, or controller, stop. Either the code needs a refactor, or you're testing the wrong layer.

### Mocking a singleton `external/` service: `vi.spyOn(Class.prototype, ...)`

`vi.mock(...)` + `vi.hoisted(...)` factory mocks only work if the mocked module is imported
*after* the mock is registered. Several services (e.g. `CompaniesService`, the sourcing
controller) instantiate `SireneService` once at module-load time — by the time a test file's
`vi.mock` factory runs, that singleton already holds a real instance, so the factory mock is never
called.

For these cases, mock the **prototype method** instead — it patches every existing instance
regardless of when it was constructed:

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SireneService } from '../../../external/insee/sirene.service';

describe('createCompany INSEE validation', () => {
    let checkSiret: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        checkSiret = vi.spyOn(SireneService.prototype, 'checkSiret');
        checkSiret.mockResolvedValue(/* SireneEtablissement */);
    });

    afterEach(() => {
        checkSiret.mockRestore();
    });

    // ...
});
```

Real examples: `src/graphql/company/__tests__/create-blacklist-validation.test.ts` and
`src/rest/sourcing/__tests__/searchBySiren.test.ts`. This is the one sanctioned exception to the
"no `vi.spyOn` on internals" rule below — it's still mocking the `external/` boundary, just via
the prototype instead of a module factory.

For routes/webhooks that send Gmail (`GoogleGmailService.prototype.sendEmail`) and/or read a
signature off Drive (`GoogleDriveService.fromTokens`), reuse `test/helpers/googleMail.ts`
(`spyOnGoogleMail()`) instead of re-declaring the spies per file — see
`src/rest/relance/__tests__/signature.test.ts`, `src/rest/yousign/__tests__/signature.test.ts`,
and `src/services/__tests__/SignedAbProcessor.test.ts` for usage.

---

## 10. Anti-patterns

- **No `vi.spyOn` on internals.** Services, repositories, resolvers, controllers — all real. Spying makes tests brittle to refactors with no upside. The one exception is spying on an `external/<vendor>/` class's prototype methods when a factory `vi.mock` can't reach an already-constructed singleton (see Section 9).
- **No mocking of `mysql2` or `mongoose`.** Use the Dockerised DBs. In-memory fakes drift from the real engines and hide bugs.
- **No sharing of dev `.env`.** Tests must point at `*_test` schemas. Misconfigure once and you wipe your dev data.
- **No reading `req.user` shape in tests.** Go through the route with an `Authorization` header. The shape is an internal detail.
- **The `sectors` column on `users` is stringified JSON.** Parse before comparing: `JSON.parse(row.sectors)`.
- **camelCase in API assertions, snake_case in raw DB rows.** Don't mix.
- **No fixtures shared across files.** Seed inside `beforeEach` or the test itself. Shared fixtures are the "domino" AAAC warns against.
- **Mongoose model re-registration.** When multiple test files import the same Mongoose model, vitest module isolation can trigger `OverwriteModelError`. Guard new schemas with `mongoose.models.Name || model(...)` — see `candidate.schema.ts` and `offer.schema.ts`.

---

## 11. Performance

- For the test MySQL container, pass `--innodb-flush-log-at-trx-commit=0 --sync-binlog=0`. Durability is wrong for tests; speed is right.
- Start single-threaded: `vitest --pool=threads --poolOptions.threads.singleThread=true`. Component tests share the DBs; parallelism comes later, once tests are isolated per schema.
- Truncate is cheaper than `DROP DATABASE`/recreate. Resist the urge to "fully reset" between tests.

---

## 12. CI

CI runs on every push and pull request via `.github/workflows/ci.yml`. It uses `docker-compose.test.yml` — a dedicated compose file with ephemeral databases (no persistent volumes) and a `test-backend` service that runs `npm ci && npm test`.

To reproduce locally from the project root:

```sh
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit
```

The `test-backend` container uses `network_mode: host` so that `localhost` resolves to the host's mapped DB ports — required because `vitest.config.ts` sets `NODE_ENV=test`, which causes `config/env.ts` to hardcode `localhost` as the DB host.

Failing tests emit `::error file=...,line=...::` annotations via Vitest's built-in `github-actions` reporter (enabled automatically when `CI=true`).

---

## Out of scope of this guide

- **Pure unit tests** for mappers and pure helpers (`services/mappers/`, `external/crypto/signers.ts`). They are valuable but tiny; write them inline next to the file with the same Vitest runner, no setup needed.
- **Repository-only integration tests** bypassing HTTP. Skip in favour of component tests — same coverage, closer to the real exit door.
- **End-to-end tests with the frontend.** Out of scope for `back/`.
