# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

Polyrepo, no root package.json:
- `back/` — Node.js + TypeScript, Express + 4 Apollo GraphQL servers + MCP server (`src/mcp/`, `POST /api/mcp`)
- `front/disciplina-front/` — React 19 + Vite + TypeScript + Tailwind v4 + urql + Zustand + React Router v7
- `database/` — MySQL (`database/mysql/`) and MongoDB (`database/mongodb/`) init scripts, seeds, migrations
- `scripts/` — Python 3.12+ data import/seed scripts (`startup.py` is the Docker seed entrypoint)
- `veille/` — separate side tooling (n8n + FreshRSS), not part of the main stack

Always `cd back` or `cd front/disciplina-front` before running npm scripts — there is no root package.json.

## Commands

Backend (`back/`):
- `npm run dev` — ts-node-dev
- `npm run build` — tsc
- `npm run lint` / `npm run lint:fix` — **oxlint**, not eslint
- `npm run format` / `npm run format:check` — prettier on `src/`
- `npm test` — vitest run (all), `npx vitest run <path>` for a single file
- `npm run test:watch` — vitest watch

Frontend (`front/disciplina-front/`):
- `npm run dev` — vite
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — eslint
- `npm run test:e2e` — playwright; `test:e2e:ci` excludes `@external`-tagged tests
- No unit test framework configured on the frontend
- CI does not run frontend lint/build/e2e at all — always run `npm run lint && npm run build` in `front/disciplina-front/` before considering frontend work done

## Local setup

- `cp .env.example .env` (root, DB creds) — a second env file `back/.env.back.example` → `back/.env` holds app secrets (JWT_SECRET, MCP_API_KEY must be ≥32 chars, OAuth, DOCUSEAL, etc.)
- `MYSQL_PASSWORD` is **required** in the root `.env` — the app runs as `disciplina_app`, not `root`. On a database created before that account existed, either apply `database/mysql/migrations/2026-08-06-app-user.sql` or set `MYSQL_USER=root`. See `back/CONVENTION.md` → *Least-privilege account* for the grant set and the two queries it forbids.
- `docker compose up` — services: sql-db (MySQL), nosql-db (MongoDB), ollama (pulls `qwen2.5:3b`, slow first boot), backend, startup-script (idempotent CSV seed), frontend
- Backend tests require live Dockerized DBs: `docker compose up -d sql-db nosql-db` first
- **MySQL port gotcha**: three different ports depending on context — `sql-db:3306` inside the compose network, `3307` in `docker-compose.test.yml`/CI, `5001` for local host dev per `.env.back.example`. Mismatched ports are the most common cause of `npm test` failing in `back/`.

## Backend conventions (see `@back/CONVENTION.md` for the full, load-bearing rulebook)

- `console.*` is banned in `back/src` — use the `logger` singleton from `external/logger/`, error logging as `{ err: error }`
- `zod` is banned in backend application code except inside `src/mcp/` (required by the MCP SDK)
- Named exports only; the sole default export is the MySQL connection pool
- MySQL domain types are camelCase (converted at repository); MongoDB domain types stay snake_case (converted at resolver) — this asymmetry is intentional, not a bug
- New MySQL columns must be added in **two places**: `database/mysql/mysql-init.sql` and `REQUIRED_COLUMNS` in `back/src/db/mysql/migrations.ts` — the init script only runs on fresh volumes, the migrations file backfills existing ones
- `CONVENTION.md` tracks known convention violations in a live table — don't "fix" tracked deviations unprompted, and don't trust its "fixed ✅" claims without re-verifying

## Testing (see `@back/HOWTOTEST.md` for full detail)

- Backend tests are component tests: boot the real Express app, hit it via `fetch()`, use real Dockerized MySQL/MongoDB
- Mock boundary is strictly `src/external/*` — never mock services, repos, resolvers, controllers, mysql2, or mongoose directly
- `vi.spyOn(Class.prototype, ...)` is the sanctioned exception for singletons instantiated at module load (e.g. `SireneService`)
- Vitest runs single-threaded (`poolOptions.threads.singleThread: true`) because tests share DB state
- `E2E.md` (root) is a manual regression checklist mapping business flows to backend test files, not an executable suite

## Exploration

For any exploration spanning more than 5 files, propose using a dedicated sub-agent rather than reading them all directly, to preserve the main context window.

## Git conventions

- Branch names: `<issue#>-<type>-<slug>` (e.g. `445-feat-import-digiforma`)
- Commit messages: `<type>(#<issue#>): <subject>`, e.g. `feat(#445): digiforma import`, `fix(#449): normalize offers`
- Merge-heavy workflow (not squash) — `Merge feat/<branch>` / `Merge main to prod` commits are normal
