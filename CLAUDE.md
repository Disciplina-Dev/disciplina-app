# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Frontend (`front/disciplina-front/`)
```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Type-check (tsc -b) + production build
npm run lint       # ESLint
```

### Backend (`back/`)
```bash
npm run dev        # ts-node-dev with hot reload (port 3001)
npm run build      # Compile TypeScript → dist/
npm start          # Run compiled JS
```

### Database
```bash
docker compose up -d                                                                  # Start MySQL 8.4 (port 3307)
docker compose down                                                                   # Stop (bind-mount data persists)
docker compose down && rm -rf database/mysql/mysql-data && docker compose up -d      # Full reset + re-init from schema.sql
```

---

## Architecture

### Stack
- **Frontend**: React 19 + TypeScript (strict), Vite 8, Tailwind CSS 4, React Router DOM 7
- **State**: Zustand (scaffolded), React Query (server state), React Hook Form (forms)
- **Backend**: Node.js / Express + TypeScript (port 3001), mysql2 for DB access
- **Database**: MySQL 8.4 via Docker (bind-mount at `database/mysql/mysql-data/`)
- **Planned**: Supabase (PostgreSQL + pgvector) for NLP matching phase; YouSign, Twilio, Brevo, Koann, Claude API

### Backend structure (`back/src/`)
- `index.ts` — entry point, DB health check, starts server
- `app.ts` — Express setup, CORS (localhost only), routes mount
- `config/db.ts` — mysql2 pool (charset: utf8mb4)
- `controllers/companies.ts` — all route handlers
- `routes/companies.ts` — `/api/companies` + sub-resources
- `routes/relances.ts` — `/api/relances`
- `types/company.ts` — shared TypeScript types

### API endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/companies` | List (filters: statut, commercial_id, search) |
| POST | `/api/companies` | Create |
| GET | `/api/companies/:id` | Detail + contacts + calls + relances |
| PUT | `/api/companies/:id` | Update (incl. statut) |
| DELETE | `/api/companies/:id` | Delete |
| GET | `/api/companies/:id/calls` | Call history |
| POST | `/api/companies/:id/calls` | Log call → auto-updates statut |
| GET | `/api/companies/:id/relances` | Company relances |
| POST | `/api/companies/:id/relances` | Create relance |
| GET | `/api/relances` | All planned relances (filter: commercial_id, statut) |
| PUT | `/api/relances/:id` | Update relance statut |

### Database schema (`schema.sql`)
Tables: `utilisateur`, `entreprise`, `contact_entreprise`, `call_logs`, `relances`, `analyse_besoin`, `ab_pending`

**Important**: ENUM values use ASCII (no accents) to avoid MySQL charset issues. Labels are mapped to French in the frontend.
| DB value | Display label |
|----------|---------------|
| `contacte` | Contacté |
| `indecis` | Indécis |
| `planifiee` | Planifiée |
| `annulee` | Annulée |

### Frontend structure (`front/disciplina-front/src/`)
- `router/index.tsx` — all routes; 3 role sections: `/commercial`, `/rh`, `/entreprise`
- `components/layout/` — `CommercialLayout`, `RHLayout`, `EntrepriseLayout` (sidebar + `<Outlet>`)
- `components/ui/` — `Button` (variants: primary, secondary, ghost, danger), `Badge` (company statuses)
- `pages/` — route-level components, organized by role
- `store/`, `services/`, `hooks/`, `utils/`, `constants/` — scaffolded, mostly empty

Path alias: `@` → `src/`

### Commercial CRM routes (`/commercial/`)
| Route | Component | Description |
|-------|-----------|-------------|
| `/commercial` | `DashboardCommercial` | KPIs, pipeline, activity, upcoming relances |
| `/commercial/portefeuille` | `PortefeuilleEntreprises` | CRM list with status tabs + search |
| `/commercial/portefeuille/nouvelle` | `NouvelleEntreprise` | 3-step wizard: SIRET → verify → details |
| `/commercial/portefeuille/:id` | `FicheEntreprise` | Company detail (tabs: infos, appel, relances, AB) |
| `/commercial/analyses-besoin` | `ListeAB` | List of ABs |
| `/commercial/analyses-besoin/nouvelle` | `CreateAB` | AB creation form |
| `/commercial/relances` | `Relances` | Grouped relances list |

### Commercial prospecting process
1. Find company (Facebook, LinkedIn, Indeed, Pages Jaunes, etc.)
2. SIRET lookup → verify active + check Digiforma → create with status `prospect`
3. Phone call → log result: `ok` (AB unlocked) | `indecis` (schedule relance) | `non` (no action)
4. Follow-ups (relances) for `indecis` companies
5. AB form filled during call when company is `ok`
6. Loyalty tracking for `partenaire` companies

### Company statuses (DB ENUM → front Badge)
`prospect` → `contacte` → `ok` | `indecis` | `non` | `partenaire`

### Design system (defined in `index.css` via Tailwind v4 `@theme`)
Font: **Poppins** · Background: `#FAF9F5`

| Token | Hex | Usage |
|-------|-----|-------|
| `blue` | `#1130A7` | Primary — buttons, active nav |
| `blue-light` | `#E8EBFA` | Tinted backgrounds |
| `blue-dark` | `#0C2180` | Hover states |
| `purple` | `#60207E` | Secondary accent |
| `pink` | `#B10F55` | Tertiary accent |
| `black` | `#0D0D0D` | Sidebar background |
| `success` / `success-bg` | `#1A7A4A` / `#E6F4ED` | OK states |
| `warning` / `warning-bg` | `#A65C00` / `#FEF3E2` | Indecis / caution |
| `danger` / `danger-bg` | `#C0152A` / `#FDEAEC` | Non / errors |

Custom radius: `rounded-sm`=6px, `rounded-md`=10px, `rounded-lg`=14px, `rounded-xl`=20px

---

## Project context

**Disciplina** is a CFA (apprenticeship training center) in Réunion island. ~200 students/year, 100 partner companies. Qualiopi-certified (mandatory). Unique advantage: "enterprise first, candidate second" (only 25% of local CFAs do this).

**5 internal services**: Commercial, RH, Pédagogie, Administratif, Direction.

**What is being built**:
1. **Intranet** — internal management tool for all 5 services
2. **Web interface** — public company page (online AB form) + RH backoffice (matching)
3. **WhatsApp bot** — for selected candidates (Twilio + Claude API)

**Core document: the AB (Analyse de Besoin)** — replaces a 5-step paper process. Goal: full dematerialization with YouSign e-signature, RGPD compliant.

**NLP matching**: candidates matched to ABs via pgvector cosine similarity (Supabase, planned).

### Development order
1. ✅ Frontend mockup — Commercial CRM (portefeuille, fiches, relances, AB)
2. ✅ Backend — Express API + MySQL (companies, calls, relances)
3. **Next** — Connect frontend to API (React Query, replace mock data)
4. AB form — fill during call, YouSign integration
5. Auth + roles
6. RH space — candidate pool + NLP matching
7. Pédagogie, Admin, Direction spaces
8. WhatsApp bot (Twilio + Claude)

### Key constraints
- **Qualiopi compliance is non-negotiable** — all features must support traceability
- Do not duplicate **Digiforma** (existing formation management tool used by Disciplina)
- Listing target: 65,000 enterprises in Réunion (sources: Lorenzo, Pages Jaunes, France Travail, LinkedIn)
- Koann auto-publish triggered when AB is complete + mandate signed
