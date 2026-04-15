# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Frontend**: React 19 + Vite 8 + TypeScript + React Compiler (Babel) + TailwindCSS 4 + Zustand + TanStack Query
- **Backend**: Node.js + TypeScript + Apollo Server 3 + GraphQL + Express
- **Database**: MySQL 8.4 (active), MongoDB (commented out in docker-compose.yaml)
- **Infra**: Docker Compose

## Commands

```bash
# Frontend (from front/disciplina-front/)
npm run dev        # Vite dev server on port 5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint (flat config)

# Backend (from back/)
npm run dev        # ts-node-dev on port 7080
npm run build      # tsc → dist/

# Full stack (from repo root)
docker compose up --build   # MySQL + Frontend containers
```

## Backend Architecture

Layered architecture with strict separation:

```
back/src/
├── index.ts               # Express + Apollo Server entry (port 7080)
├── db/connection.ts        # mysql2/promise pool (getConnection, query<T>)
├── repositories/          # Raw SQL queries → DB row types
├── services/              # Business logic + mappers (DB rows → domain types)
└── graphql/
    ├── typeDefs.ts         # Schema definition
    └── resolvers.ts        # Query/mutation resolvers
```

When adding a new domain entity, follow this pattern: `Repository` (SQL) → `Service` (logic + mapping) → `typeDefs` + `resolvers` (GraphQL).

**GraphQL endpoint**: `http://localhost:7080/api/graphql/companies`

Available operations on `Company`:
- Queries: `companies`, `companyByCommercial(commercial)`, `companyBySiret(siret)`
- Mutations: `createCompany(input)`, `updateCompany(id, input)`, `deleteCompany(id)`

## Frontend Architecture

Three user roles, each with their own layout and route tree:

- `/commercial/*` — Commercial (sales) role
- `/rh/*` — RH (HR/recruitment) role
- `/entreprise/*` — Entreprise (company) role
- `/` — `SelectProfil` (role picker)
- `/login`, `/register` — `AuthLayout`

```
front/disciplina-front/src/
├── pages/          # Page components organized by role (commercial/, rh/, entreprise/)
├── components/layout/  # Role-specific layout wrappers
├── features/       # Feature modules
├── store/          # Zustand stores
├── services/       # API/business logic
├── hooks/          # Custom React hooks
├── router/         # createBrowserRouter config
└── types/          # Shared TypeScript types
```

**Path alias**: `@` → `./src`

## Frontend Quirks

- TailwindCSS v4 uses `@tailwindcss/vite` plugin — no PostCSS config needed
- React Compiler is enabled via `babel-plugin-react-compiler` with `@rolldown/plugin-babel` — avoid manually memoizing with `useMemo`/`useCallback`

## Database

MySQL runs at `localhost:5001` (mapped from container port 3306).

Connection env vars: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`

Init schema: `database/mysql/mysql-init.sql`

## Frontend / Backend coupling

**The frontend is currently NOT connected to the backend.** All data is local:

- Company data loads from `src/data/entreprises.json` and is persisted via Zustand + localStorage (`portefeuilleStore.ts`)
- The `analyse_besoin` form (`CreateABModal.tsx`) submits locally only — the `onSubmit` handler in `PortefeuilleEntreprises.tsx` has a `TODO: POST /api/ab` comment

When connecting the frontend to the backend, TanStack Query is already installed for data fetching.

## Feature: Analyse de Besoin (in progress)

The AB feature is **frontend-only** for now. What exists:

- Button "Créer une AB" on the company detail modal (`DetailModal.tsx`)
- 6-step creation form (`features/portefeuille/components/CreateABModal.tsx`)

What still needs to be built:

| Step | What |
|------|------|
| Backend | `analyse_besoin` table + REST routes (`POST /api/ab`, `GET /api/ab/:token`, `PUT /api/ab/:token`, `POST /api/ab/:token/valider`, `GET /api/ab`) |
| Connect | Wire `onSubmit` in `PortefeuilleEntreprises.tsx` to `POST /api/ab` |
| Public view | `/ab/:token` — public page (no sidebar) for the company to fill/validate the form |
| AB list | `/commercial/analyses-besoin` — table with filters (statut, campus, commercial, filière) |
| Email | Brevo integration — send link on creation, resend option |
| PDF + Sign | WeasyPrint PDF generation + YouSign SaaS on validation |

Planned `analyse_besoin` table columns: `id`, `token UUID`, `entreprise_id`, `contact_id`, `commercial_id`, `campus`, `statut` (`envoyée`→`validée`→`signée`→`archivée`), `filiere`, `poste`, `missions JSONB`, `criteres_candidat JSONB`, `preferences_recrutement JSONB`, `yousign_procedure_id`, `pdf_url`, `expires_at` (NOW() + 14 days), `created_at`, `updated_at`.

## Utility Scripts

Located in `scripts/`:
- `csv_to_database.py` — Import `ressources/suivi_client-contact.csv` into MySQL (requires Python venv)
- `test_graphql.py` — Smoke-test all GraphQL CRUD operations
