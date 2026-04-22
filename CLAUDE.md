# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend (from back/)
npm run dev      # ts-node-dev with hot reload on port 4000
npm run build    # tsc → dist/
npm start        # node dist/index.js

# Frontend (from front/disciplina-front/)
npm run dev      # Vite dev server on port 5173
npm run build    # tsc -b && vite build
npm run lint     # ESLint

# Full stack
docker compose up --build   # MySQL on :5001 + backend on :4000 + frontend on :5173
```

No test framework is configured.

## Architecture

Monorepo with a clear frontend/backend split:

```
disciplina-app/
├── back/                  # Express + Apollo Server GraphQL API
├── front/disciplina-front/ # React 19 + Vite SPA
├── database/mysql/        # MySQL init SQL (sales_service schema)
├── scripts/               # Python utilities (CSV import, GraphQL tests)
└── docker-compose.yaml    # Orchestrates MySQL, backend, frontend
```

### Backend layers (`back/src/`)

Strict 3-layer architecture — data only flows top-down:

1. **GraphQL layer** (`graphql/typeDefs.ts`, `resolvers.ts`) — single endpoint at `/api/graphql/companies`
2. **Service layer** (`services/`) — business logic; `mappers.ts` converts snake_case DB rows → camelCase domain types
3. **Repository layer** (`repositories/`) — raw SQL via `mysql2/promise`; no ORM

DB connection pool lives in `db/connection.ts` with a generic `query<T>()` helper.

### Frontend structure (`front/disciplina-front/src/`)

- **GraphQL** (`graphql/client.ts`, `queries.ts`, `hooks.ts`) — Urql client; custom hooks sync fetched data into Zustand store
- **Store** (`store/`) — Zustand for global state (companies, salePersons)
- **Features** (`features/`) — UI organized by domain: `portefeuille`, `entreprises`, `abApprentis`, `abEntreprise`, `candidats`, `matching`, `calendrier`
- **Path alias**: `@` → `src/`

### Database

MySQL 8.4 — `sales_service` database with two tables: `sale_persons` and `companies` (FK: `companies.sale_person_id → sale_persons.id`). Schema in `database/mysql/mysql-init.sql`.

## Feature — Analyse de Besoin (AB)

Flux : Commercial crée une AB depuis une fiche entreprise → token UUID généré → email envoyé via **Brevo** → lien public `/ab/:token` pour l'entreprise (sans compte) → validation → PDF via **WeasyPrint** → signature via **YouSign SaaS**.

Statuts : `envoyée` → `validée` → `signée` → `archivée`

### Routes REST (pas GraphQL — même architecture back existante)
- `POST /api/ab` — créer + envoyer email Brevo immédiatement
- `GET /api/ab/:token` — accès public, vérifie expiration
- `PUT /api/ab/:token` — modifier
- `POST /api/ab/:token/valider` — orchestre PDF + YouSign (voir flux ci-dessous)
- `POST /api/ab/:token/renvoyer` — renvoyer le lien
- `GET /api/ab` — liste avec filtres (statut, campus, filière, commercial)
- `POST /api/webhooks/yousign` — reçoit les events YouSign (`signature_request.done`, `.expired`)

### Table `analyse_besoin` (MySQL — JSON pas JSONB)
Token UUID unique, expiration `NOW() + 14 jours`, `ON DELETE CASCADE` sur les FK.
Colonnes JSON : `missions`, `jours_formation`.
Campus : Nord / Ouest / Sud. Filières : Vente / Secrétariat.
Colonnes YouSign : `yousign_procedure_id`, `pdf_url`.

### Formulaire AB — 5 étapes
1. **Identité entreprise** — pré-rempli depuis fiche. Campus auto depuis `currentUser.campus`. Adresse parsée avec regex pour extraire CP + commune. Code postal → API `geo.api.gouv.fr` pour auto-compléter la commune.
2. **Poste + missions** — activité, nb postes, localisation, domaine (radio Vente/Secrétariat), intitulé poste (select dépendant), checklist missions avec "Tout cocher", profil/compétences/commentaires
3. **Exigences apprenti** — niveau, permis, expérience, âge, méthode recrutement (cards avec description), PMSMP, tableau jours de formation (Lun→Ven, radio Oui/Non/Préféré, défaut=Non)
4. **Engagement missions** — 3 cases pré-cochées lecture seule
5. **Récap + validation** — aperçu document complet + checkbox certification + bouton "Valider"

La clause de confidentialité et la signature sont gérées directement par YouSign (pas dans le formulaire).

### Missions par poste (référentiel figé dans le code, pas en DB)
Secrétariat : Secrétaire Assistante (9 missions), Assistante de Direction (13 missions)
Vente : Conseiller Commercial (15), Négociateur (14), Technico-Commercial (15), Responsable d'Établissement Marchand (mêmes que Technico-Commercial)

### Vues React
- **Fiche entreprise** : bouton "Créer une AB" → navigate vers `/commercial/analyses-besoin/nouvelle` avec `state: { entreprise }`
- **`/ab/:token`** : layout standalone sans sidebar, formulaire 5 étapes, page erreur si expiré (à implémenter)
- **`/commercial/analyses-besoin`** : tableau global avec filtres (à implémenter)

### PDF — WeasyPrint + Jinja2 (Python)

**Fichiers :**
- `templates/ab_template.html` — template Jinja2 reproduisant le document officiel Disciplina
- `services/pdf_generator.py` — reçoit JSON sur stdin, écrit PDF bytes sur stdout

**Contrainte critique :** la dernière page du PDF est dédiée exclusivement au bloc signature (`page-break-before: always`). Les coordonnées de signature sont donc toujours identiques → le template YouSign peut positionner les zones de signature une seule fois.

**Dépendances Python à installer :**
```bash
pip install weasyprint jinja2
# WeasyPrint requiert Cairo + Pango au niveau système :
# macOS  : brew install cairo pango gdk-pixbuf libffi
# Ubuntu : apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b
```

### YouSign — Intégration (back/src/services/yousign.ts)

Flux séquentiel dans `AnalyseBesoinService.valider()` :
1. `generatePdf(row)` — appelle `python3 pdf_generator.py` via stdin/stdout
2. `uploadDocument(pdfBuffer, filename)` → `POST /documents` → `document_id`
3. `createSignatureRequest(documentId, row)` → `POST /signature_requests` avec `template_id` → `signature_request_id`
4. `activateSignatureRequest(id)` → `POST /signature_requests/{id}/activate` → YouSign envoie l'email
5. Sauvegarde `yousign_procedure_id` en base

**Template YouSign :** configurer une seule fois dans le dashboard YouSign SaaS avec les zones de signature positionnées sur la page dédiée. Le code ne définit jamais de coordonnées x/y.

**Webhook :** `signature_request.done` → récupère PDF signé → TODO upload Supabase Storage → `statut = 'signée'`

### Variables d'environnement (back/.env)
```
YOUSIGN_API_KEY=           # clé API YouSign
YOUSIGN_TEMPLATE_ID=       # ID du template YouSign préconfiguré
YOUSIGN_API_URL=https://api-sandbox.yousign.app/v3   # sandbox / prod
SUPABASE_URL=              # TODO — pour stockage PDF signés
SUPABASE_SERVICE_KEY=      # TODO
SUPABASE_BUCKET=ab-pdfs    # TODO
```

## Key quirks

- **TailwindCSS v4**: uses `@tailwindcss/vite` plugin — no `tailwind.config.js` or PostCSS config
- **React Compiler**: enabled via `babel-plugin-react-compiler` + `@rolldown/plugin-babel` in Vite config — avoid manual `useMemo`/`useCallback` unless necessary
- **MySQL port mapping**: container port 3306 is exposed as `localhost:5001`
- **GraphQL URL**: hardcoded to `http://localhost:4000/api/graphql/companies` in `src/graphql/client.ts`
