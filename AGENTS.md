# AGENTS.md - disciplina-app

## Stack
- **Frontend**: React 19 + Vite 8 + TypeScript + React Compiler (Babel) + TailwindCSS 4 + Zustand
- **Backend**: Empty (placeholder only)
- **DBs**: MySQL 8.4 (active), MongoDB (commented out in docker-compose.yaml)
- **Infra**: Docker Compose

## Commands

```bash
# Frontend development (from front/disciplina-front)
npm run dev      # Start Vite dev server on port 5173
npm run build    # TypeScript build + Vite build
npm run lint     # ESLint

# Full stack (from repo root)
docker compose up --build   # Start MySQL + Frontend
```

## Frontend quirks
- TailwindCSS v4 uses `@tailwindcss/vite` plugin, not PostCSS config
- Path alias `@` maps to `./src`
- React Compiler uses `babel-plugin-react-compiler` with `@rolldown/plugin-babel`

## Database
- MySQL runs on `localhost:5000` (mapped from container port 3306)
- Init script: `database/mysql/mysql-init.sql`
- Env vars in `.env` (see `.env.example`)

## Known issues
- Backend directory is empty (no API yet)
- MongoDB service commented out in docker-compose.yaml
- CSV import script (`scripts/csv_to_database.py`) is empty