# Disciplina

App for apprenticeship management — candidate tracking, company matching, and recruitment follow-up.

## Prerequisites

- **Docker** & **Docker Compose** (required for the full stack)
- **Node.js 18+** (only for running the backend locally without Docker)
- **Python 3.12+** (only for running seed scripts locally)
- **Git**

## Quick Start

```bash
git clone <repo-url> disciplina-app
cd disciplina-app

cp .env.example .env   # edit with your DB credentials
docker compose up
```

### Access points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| GraphQL (companies) | `/api/graphql/companies` |
| GraphQL (candidates) | `/api/graphql/candidates` |
| GraphQL (jobs) | `/api/graphql/jobs` |
| MySQL | `localhost:5001` |
| MongoDB | `localhost:4011` |

### First startup

1. DB init scripts run automatically (MySQL schema + MongoDB collections with `$jsonSchema`)
2. `startup-script` seeds data from CSV files into both databases
3. Backend starts (4 Apollo GraphQL servers + REST routes)
4. Frontend starts (React + Vite)

On subsequent starts, the seed script checks if data already exists and skips seeding.

## Testing

Backend tests are component tests — they boot the real Express app against real Dockerised databases. See [`back/HOWTOTEST.md`](./back/HOWTOTEST.md) for conventions and patterns.

```sh
# Start databases
docker compose up -d sql-db nosql-db

# Run the backend test suite
cd back && npm test

# Reproduce the CI stack locally (ephemeral DBs, no persistent volumes)
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit
```

CI runs automatically on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`). Failing tests appear as inline annotations on the PR diff.

## Project Architecture

```
disciplina-app/
├── back/                 Node.js + TypeScript — Express + Apollo GraphQL
│   ├── src/
│   │   ├── rest/         REST routes (auth, email, relance)
│   │   ├── graphql/      3 Apollo Servers (companies, candidates, jobs)
│   │   ├── services/     Business logic layer
│   │   ├── repositories/ MySQL & MongoDB data access
│   │   └── external/     Google OAuth/Drive/Gmail, crypto, logger
│   ├── CONVENTION.md     Code style & architecture conventions
│   └── README.md         Backend documentation
├── front/
│   └── disciplina-front/ React 19 + Vite + Tailwind + urql + Zustand
│       └── README.md     Frontend documentation
├── database/
│   ├── mysql/            MySQL init SQL + persistent data volume
│   └── mongodb/          MongoDB init JS with $jsonSchema validation
├── scripts/              Python data import scripts
│   ├── startup.py        Consolidated seed script (Docker entrypoint)
│   └── resource/         CSV data files
└── docker-compose.yaml   Orchestrates all 5 services
```

## Docker Compose Structure

```
┌───────────┐   ┌──────────────┐   ┌──────────────┐
│  sql-db   │   │  nosql-db    │   │startup-script│
│  MySQL    │   │  MongoDB     │   │(seed, exits) │
│  :3306    │   │  :27017      │   │              │
└─────┬─────┘   └──────┬───────┘   └──────┬───────┘
      │                │                  │
      └─────────backend-net───────────────┘
                         │
                 ┌───────▼────────┐
                 │   backend      │
                 │  Express/Apollo│
                 │   :4000        │
                 └───────┬────────┘
                         │ frontend-net
                 ┌───────▼────────┐
                 │   frontend     │
                 │   React/Vite   │
                 │   :5173        │
                 └────────────────┘
```

### Services

| Service | Image | depends_on | Restart |
|---------|-------|------------|---------|
| `sql-db` | mysql:8.4.8 | — | always |
| `nosql-db` | mongo:latest | — | always |
| `backend` | custom (back/Dockerfile) | sql-db, nosql-db (healthy) | always |
| `startup-script` | custom (scripts/Dockerfile) | sql-db, nosql-db (healthy) | no |
| `frontend` | custom (front/Dockerfile) | backend (started) | always |

### Networks

- **backend-net**: connects sql-db, nosql-db, backend, startup-script
- **frontend-net**: connects backend, frontend

### Startup sequence

1. **sql-db** + **nosql-db** initialize (schemas + collections created via `docker-entrypoint-initdb.d/`)
2. **startup-script** runs — reads CSV files from `scripts/resource/`, imports data into both databases, then exits
3. **backend** starts — 4 Apollo GraphQL servers + REST routes mounted on Express
4. **frontend** starts — Vite dev server proxies requests to backend

## Environment

Two `.env` files are loaded at startup:

**Root `.env`** — database credentials:

```env
MYSQL_ROOT_PASSWORD=
MYSQL_HOST=sql-db
MYSQL_PORT=3306
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
MONGO_PORT=27017
```

**`back/.env`** — app secrets (JWT, Google OAuth, SMTP). See `back/README.md` for the full list.

## Contributing

See the detailed documentation in each sub-project:

- **Backend**: [`back/README.md`](./back/README.md) — API reference, architecture layers, command reference
- **Backend conventions**: [`back/CONVENTION.md`](./back/CONVENTION.md) — code style, naming, error handling, auth flow
- **Backend contribution guide**: [`back/HOWTOCONTRIBUTE.md`](./back/HOWTOCONTRIBUTE.md) — how to add features, refactor, fix bugs
- **Backend testing guide**: [`back/HOWTOTEST.md`](./back/HOWTOTEST.md) — component test conventions and patterns
- **Frontend**: [`front/disciplina-front/README.md`](./front/disciplina-front/README.md) — React + Vite setup
- **Database schemas**: [`database/champs.md`](./database/champs.md) — form field reference per Titre Professionnel
