---
name: verify-backend
description: Lint, build, and run the backend test suite in back/. Use before considering any backend change done, or when the user asks to verify/check the backend.
---

Run from the `back/` directory, in order, stopping at the first failure:

1. `npm run lint` — oxlint
2. `npm run build` — tsc
3. `npm test` — vitest run (component tests against real MySQL/MongoDB)

Before step 3, confirm the Dockerized DBs are up: `docker compose up -d sql-db nosql-db` (from repo root). If tests fail with connection errors, check the MySQL port in use matches the context (see CLAUDE.md port gotcha) before assuming a real regression.

Report pass/fail for each step. On failure, show the relevant error output, not the full log.
