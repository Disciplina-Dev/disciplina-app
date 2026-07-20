# Disciplina — Frontend

React 19 / TypeScript / Vite SPA with Tailwind CSS v4, URQL GraphQL client, and Zustand state management.

## Quick start (Docker)

The easiest way to run the full stack:

```sh
docker compose up --build
```

This starts MySQL, MongoDB, the backend (port 4000), a seed/startup script, and the frontend (port 5173). For manual setup or local development, see [Environment](#environment).

## Architecture

```
src/
  main.tsx              App entry point — mounts React root, wraps with router providers
  index.css             Global styles + Tailwind v4 theme import
  router/
    index.tsx           All route definitions — createBrowserRouter (React Router v7)
  api/                  13 typed REST fetch clients — booking, calendar, candidates,
                        classmarker, directory, interview, kpi, mailTemplates, match,
                        peda, relance, rhKpi, sectorSettings
  graphql/
    client.ts           4 separate URQL clients for 4 backend GraphQL endpoints
                        (companies, candidates, offers, needs-analysis)
    queries.ts          All GraphQL query/mutation strings (1619 lines)
    hooks.ts            Custom hooks wrapping URQL queries with data mapping
  store/                Zustand state stores with localStorage persistence
    authStore.ts        Auth state — token, user, role (persisted as "disciplina-auth")
    blacklistStore.ts   Blacklisted companies list
    portefeuilleStore.ts Company portfolio & sale persons
    mailTemplatesStore.ts Mail template state per scope (rh/commercial/peda)
    guestMatchTokenStore.ts   Guest match token (sessionStorage)
    guestInterviewTokenStore.ts Guest interview token (sessionStorage)
  components/
    layout/             Role-specific layouts with sidebar navigation:
                        AdminLayout, AppLayout, AuthLayout, CommercialLayout,
                        EntrepriseLayout, PedaLayout, RHLayout, Sidebar, Footer
    ui/                 Atomic design system: Button, InputField, PasswordInput,
                        MultiSelectField, AddressAutocomplete, RichTextEditor,
                        SignaturePad, MailModal, RouteBreadcrumb
    rh/                 RH-specific components: CandidateFormModal, CandidateAvatar,
                        CandidateTestScore, ClassMarkerLinksModal, FilizFolderModal,
                        WebcamCaptureModal
    admin/              UserEditModal
    notifications/      NotificationBell (SSE-based)
    ProtectedRoute.tsx  Role-based route guard
    GoogleDriveConnect.tsx Google Drive OAuth connect
  features/             Feature modules with their own components
    portefeuille/       Company portfolio CRUD modals, timeline, contact logs,
                        relance history, linked establishments, filter panel
    matching/           Matching workflow — job filters, interview/immersion
                        conclusion modals, candidate management modal
    kpi/                KPI dashboard — charts (recharts), weekly/year overview,
                        Excel import, RH KPI panel
    abEntreprise/       Needs analysis ("Analyse de Besoin") — detail modals,
                        signature preview
    candidats/          Candidate modals — add to job, history, job search
    blacklist/          Blacklisted company card
    publicMatch/        Public matching — comparator, gate form, answer controls
    publicInterview/    Public interview — gate form
    todos/              Todo page with local operations
  pages/                Route-level page components (organized by role)
    rh/                 DashboardRH, FicheCandidat, ListeCandidats, Matching,
                        Calendrier, MailTemplates, Relance, DriveConfig…
    commercial/         DashboardCommercial, PortefeuilleEntreprises, ListeAB,
                        CreateAB, Sourcing, ListeNoire, RelanceCommercial…
    entreprise/         DashboardEntreprise, FormulaireAB, GestionApprentis,
                        GestionRDV, ProfilsMatches
    admin/              AdminUsers
    peda/               SuiviAbsences
    profile/            ProfilePage
    publicMatch/        MatchGate, MatchComparator
    publicInterview/    InterviewGate, InterviewSlotPicker
    booking/            PublicBooking
    LoginPage.tsx       Login form
    RegisterPage.tsx    Register form
    GoogleAuthCallback.tsx Google OAuth popup callback
    Drive.tsx           Google Drive file viewer
    NotFound.tsx        404
  hooks/                Custom React hooks
    useGoogleOAuthPopup.ts OAuth popup flow
    useNotifications.ts    SSE notification polling
    useClassMarkerResult.ts ClassMarker test results
    useAbSignedNotification.ts AB signed notification
    usePersistedListView.ts List view preference
    useStaffDirectory.ts Staff directory
  types/                TypeScript types: candidate, entreprise, needsAnalysis,
                        classmarker, relance, sourcing, pagination, companyMapper
  constants/            Label maps, status enums, colors
  data/                 Static data: NAF codes, Reunion communes, sectors,
                        candidate templates, mock data
  utils/                Helpers: age, slug, trainingDays, interview, classmarker,
                        lazyWithRetry, companyErrors
  services/             Singleton services: sanitizeHtml (DOMPurify wrapper)
  lib/                  Library-level utilities
    sessionGuard.ts     Global fetch() 401 interceptor — auto-logout on session expiry
```

## Routes

### Public (no auth)

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `LoginPage` | Login |
| `/auth/google` | `GoogleAuthCallback` | Google OAuth redirect callback |
| `/register` | Redirect → `/admin/utilisateurs/nouveau` | Retro-compat |
| `/utilisateurs` | Redirect → `/admin/utilisateurs` | Retro-compat |
| `/booking/:slug` | `PublicBooking` | Public booking page |
| `/public/match` | `MatchGate` | Public match authentication gate |
| `/public/match/:signature` | `MatchComparator` | View & answer match proposals |
| `/public/interview` | `InterviewGate` | Public interview auth gate |
| `/public/interview/:signature` | `InterviewSlotPicker` | Pick interview slot |
| `*` | `NotFound` | 404 |

### Admin (`/admin`) — Role: ADMIN

| Path | Component | Purpose |
|------|-----------|---------|
| `/admin/utilisateurs` | `AdminUsers` | User management |
| `/admin/utilisateurs/nouveau` | `RegisterPage` | Create user |

### Commercial (`/commercial`) — Role: COMMERCIAL / RESPONSABLE / ADMIN

| Path | Component | Purpose |
|------|-----------|---------|
| `/commercial` | `DashboardCommercial` | Commercial dashboard |
| `/commercial/kpi/:userId` | `CommercialKpiProfil` | Individual KPI profile |
| `/commercial/analyses-besoin` | `ListeAB` | Needs analyses list |
| `/commercial/analyses-besoin/nouvelle` | `CreateAB` | New needs analysis |
| `/commercial/portefeuille` | `PortefeuilleEntreprises` | Company portfolio |
| `/commercial/portefeuille/:slug` | `EntreprisePage` | Company detail |
| `/commercial/liste-noire` | `ListeNoire` | Blacklisted companies |
| `/commercial/sourcing` | `Sourcing` | SIRET sourcing |
| `/commercial/mail` | `MailTemplates` | Email templates |
| `/commercial/relance` | `RelanceCommercial` | Commercial relance |
| `/commercial/todos` | `TodoPage` | Task list |
| `/commercial/profil` | `ProfilePage` | User profile |
| `/commercial/config-drive` | `AbDriveConfig` | Drive folder config (ADMIN/RESPONSABLE only) |

### RH (`/rh`) — Role: RH / RESPONSABLE / ADMIN

| Path | Component | Purpose |
|------|-----------|---------|
| `/rh` | `DashboardRH` | RH dashboard |
| `/rh/candidats` | `ListeCandidats` | Candidate list |
| `/rh/candidats/:id` | `FicheCandidat` | Candidate detail |
| `/rh/candidats/:id/questionnaire` | `QuestionnaireAB` | Candidate questionnaire |
| `/rh/matching` | `Matching` | Job matching |
| `/rh/calendrier` | `Calendrier` | Calendar |
| `/rh/analyses-besoin` | `ABEntreprisesRecues` | Received needs analyses |
| `/rh/mail` | `MailTemplates` | Email templates |
| `/rh/relance` | `Relance` | Relance |
| `/rh/todos` | `TodoPage` | Task list |
| `/rh/profil` | `ProfilePage` | User profile |
| `/rh/config-drive` | `DriveConfig` | Drive config (ADMIN/RESPONSABLE only) |
| `/rh/config-secteurs` | `SectorSettings` | Sector locations (ADMIN/RESPONSABLE only) |

### Pedagogy (`/peda`) — Role: PEDA / ADMIN

| Path | Component | Purpose |
|------|-----------|---------|
| `/peda` | `SuiviAbsences` | Absence tracking |
| `/peda/mail` | `MailTemplates` | Email templates |
| `/peda/profil` | `ProfilePage` | User profile |

### Enterprise (`/entreprise`) — Role: ENTREPRISE

| Path | Component | Purpose |
|------|-----------|---------|
| `/entreprise` | `DashboardEntreprise` | Company dashboard |
| `/entreprise/analyse-besoin` | `FormulaireAB` | Needs analysis form |
| `/entreprise/apprentis` | `GestionApprentis` | Manage apprentices |
| `/entreprise/rendez-vous` | `GestionRDV` | Manage appointments |
| `/entreprise/profils` | `ProfilsMatches` | Matched profiles |

## Commands

```sh
npm run dev       # vite — start dev server with HMR
npm run build     # tsc -b && vite build — type-check then build for production
npm run lint      # eslint . — lint all source files
npm run preview   # vite preview — preview production build locally
```

## Testing

No test framework is configured yet. To add one, see [vitest](https://vitest.dev) or [Playwright](https://playwright.dev) as candidates.

## Pre-commit hooks

None configured. The root repository uses a Python `pre-commit` setup for the backend only.

## Environment

The frontend requires one environment variable at build/runtime:

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL for all API calls (GraphQL + REST) — e.g. `http://localhost:4000` |

There is no `.env` file committed in this directory (`.env` and `.env.production` are in `.gitignore`). The variable is typically provided via the Docker Compose environment or a `.env` file at the monorepo root.

Usage in code: `import.meta.env.VITE_API_URL`.

## Auth flow

1. **Login**: `POST /api/auth/login` → receives `{ token, user }` → stored in Zustand `authStore` (persisted to `localStorage` as `disciplina-auth`)
2. **Route guarding**: `ProtectedRoute` checks for token/user — redirects to `/` if missing; enforces role-based access (ADMIN bypasses all, RESPONSABLE bypasses most)
3. **API auth**: All REST fetch clients attach `Authorization: Bearer ${token}`; URQL clients use an `authExchange` for GraphQL
4. **Session expiry**: `src/lib/sessionGuard.ts` installs a global `window.fetch` interceptor — on any 401 from `VITE_API_URL` (excluding login), calls `handleSessionExpired()` → clears auth → redirects to login
5. **Google OAuth**: Popup-based flow — fetch OAuth URI from backend → user consents → popup sends `code` via `postMessage` → backend exchanges for tokens → user is updated
6. **Guest tokens**: Match and interview public pages use lightweight Zustand stores in `sessionStorage`

## Key dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2 | UI framework |
| `react-dom` | ^19.2 | DOM rendering |
| `react-router-dom` | ^7.13 | Client-side routing |
| `vite` | ^8.0 | Build tool & dev server |
| `typescript` | ~5.9 | Type safety |
| `tailwindcss` | ^4.2 | Utility-first CSS |
| `urql` | ^5.0 | GraphQL client |
| `zustand` | ^5.0 | State management (with `persist` middleware) |
| `react-hook-form` | ^7.72 | Form handling |
| `@tanstack/react-query` | ^5.96 | Server state (minimal usage) |
| `recharts` | ^3.8 | Charts (KPI dashboards) |
| `lucide-react` | ^1.7 | Icon library |
| `@tiptap/react` | ^2.11 | Rich text editor (mail templates) |
| `@dnd-kit/core` | ^6.3 | Drag & drop |
| `date-fns` | ^4.1 | Date utilities |
| `dompurify` | ^3.4 | HTML sanitization |
| `@react-oauth/google` | ^0.13 | Google OAuth login |
| `@vitejs/plugin-react` | ^6.0 | Vite React plugin (with React Compiler) |
| `eslint` | ^9.39 | Linter (flat config) |
