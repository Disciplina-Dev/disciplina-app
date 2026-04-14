# AGENTS.md - disciplina-app

## Stack
- **Frontend**: React 19 + Vite 8 + TypeScript + React Compiler (Babel) + TailwindCSS 4 + Zustand
- **Backend**: Node.js + TypeScript + Apollo Server + GraphQL + Express
- **DBs**: MySQL 8.4 (active), MongoDB (commented out in docker-compose.yaml)
- **Infra**: Docker Compose

## Commands

```bash
# Frontend development (from front/disciplina-front)
npm run dev      # Start Vite dev server on port 5173
npm run build    # TypeScript build + Vite build
npm run lint     # ESLint

# Backend development (from back)
npm run dev      # Start GraphQL server on port 4000
npm run build    # TypeScript compilation to dist/

# Full stack (from repo root)
docker compose up --build   # Start MySQL + Frontend
```

## Backend Structure
```
back/
├── src/
│   ├── index.ts              # Express + Apollo Server entry
│   ├── db/connection.ts      # MySQL connection (mysql2)
│   ├── repositories/        # DB queries layer
│   │   ├── interfaces.ts    # CompaniesRow interface
│   │   └── CompaniesRepository.ts
│   ├── services/             # Business logic layer
│   │   ├── interfaces.ts    # Companies interface
│   │   ├── mappers.ts       # toCompanies() function
│   │   └── CompaniesService.ts
│   └── graphql/              # GraphQL layer
│       ├── typeDefs.ts      # Schema + types
│       └── resolvers.ts     # Resolver functions
```

## GraphQL Endpoint
- URL: `http://localhost:4000/api/graphql/companies`
- Queries: `companies`, `companyByCommercial(commercial)`, `companyBySiret(siret)`
- Mutations: `createCompany(input)`, `updateCompany(id, input)`, `deleteCompany(id)`

## Frontend quirks
- TailwindCSS v4 uses `@tailwindcss/vite` plugin, not PostCSS config
- Path alias `@` maps to `./src`
- React Compiler uses `babel-plugin-react-compiler` with `@rolldown/plugin-babel`

## Database
- MySQL runs on `localhost:5000` (mapped from container port 3306)
- Init script: `database/mysql/mysql-init.sql`
- Env vars: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`

## Scripts
- `scripts/csv_to_database.py` - Import CSV to MySQL
- `scripts/test_graphql.py` - Test all GraphQL queries/mutations

## Known issues
- MongoDB service commented out in docker-compose.yaml