# Audit dépendances — Front + Back

- Date : 2026-09-21. Méthode : `npm audit --json` + `npm outdated --json` + `npm ls` + `npm view` sur `back/` et `front/disciplina-front/`.
- Constat : **aucun `dependabot.yml`** dans le repo (`.github/` ne contient que `workflows/ci.yml`). Le repo ne bénéficie donc d'aucune mise à jour automatisée — voir proposition §5.
- Légende priorité : **P0** critique (exploitable / runtime cassé), **P1** haute (CVE, fix dispo), **P2** moyenne (dette, breaking à planifier), **P3** basse (patchs mineurs).
- Légende complexité : **S** (`npm update`, sans changement de code), **M** (minor/majeur avec tests), **L** (migration breaking / changement de lib).

## 1. Back (`back/package.json`) — `npm audit` : 0 critical, 3 high, 8 moderate

| Package (installé → fix) | Pourquoi ça ne convient pas | Comment résoudre | Pri. | Cplx. |
|---|---|---|---|---|
| `multer` 2.2.0 → **2.4.0** | 4 CVE : DoS noms de champs (7.5), fuite de FD sur upload aborté (7.5), DoS index array oversize (7.5), bypass `fileFilter` (3.7). Upload = surface exposée. | `npm update multer` (minor, changelog à vérifier sur `fileFilter`/limites). | P0 | S |
| `qs` 6.15.2 → **≥6.16.0** via `express` 4.22.2 → **4.22.3+** | 2 CVE (`array-limit` bypass, DoS `isBuffer`). `qs` tiré par `express@4` + `body-parser`. | `npm update express qs` ; rester sur Express 4 patché à court terme (Express 5 = autre ligne §3). | P1 | S |
| `mysql2` 3.22.0 → **3.24.4** | GHSA-rgwj-5xj2-c3m3 : bombe de décompression zlib (DoS, 5.9), protocole compressé. | `npm update mysql2`, tests connexion/requêtes. | P1 | S |
| `fast-uri` 3.1.5 → **≥3.1.6** (transitive via `ajv` ← `@modelcontextprotocol/sdk`) | 4 CVE SSRF/host-confusion (7.5 ×4). | `npm update ajv @modelcontextprotocol/sdk` ; si `ajv` pinné, `overrides` ciblé `fast-uri`. | P1 | S–M |
| `hono` 4.13.0 → **≥4.13.5** (transitive via `@hono/node-server` ← MCP SDK) | 3 CVE moderate (path traversal `toSSG`, DoS `parseBody`, parsing query après fragment). | `npm update @modelcontextprotocol/sdk @hono/node-server`. | P1 | S–M |
| `nanoid` 3.3.16 → **≥3.3.18** (transitive via `postcss` ← `vite` ← `vitest`) | Boucle infinie si générateur custom `size=0` (DoS). | `npm update vite vitest` en dev ; passe en même temps que §vitest. | P1 | S |
| `vitest` 3.2.7 / `@vitest/coverage-v8` 3.2.7 → **5.0.1** | GHSA-82fw-gwwq-j7x9 : path traversal / lecture de fichier via `@vitest/mocker` (5.9). Dev-only → impact CI/dev, pas prod. | Major 3→5 : monter en une fois `vitest` + `@vitest/coverage-v8`, relancer suite complète. | P1 (dev) | M |
| `pdf-parse` 1.1.1 (wanted 1.1.4, latest **2.4.5**) | Ligne 1.x figée, API legacy ; tout l'écosystème est en 2.x. Pas de CVE ouverte remontée, mais dette + perf/sécurité non suivies. | Migration **v1→v2** (breaking : import ESM, API async) : isoler l'usage dans un module, tests sur PDF réels. | P2 | L |
| `exceljs` **4.4.0** | Projet quasi-abandonné (release 4.4.0 d'oct. 2023, seule pré-release déc. 2024), tire `archiver`/`minimatch` anciens. Risque maintenance, pas de CVE directe remontée. | Remplacer par `exceljs` fork actif ou `xlsx`/` SheetJS` selon besoin (écriture seule ?), ou geler + auditer `archiver`. | P2 | L |
| `express` 4.22.2 (latest **5.2.1**) | Ligne 4 en maintenance ; v5 stable depuis longtemps (Sept 2026). Ne pas confondre avec le patch P1 ci-dessus. | Migration 4→5 planifiée (breaking : gestion erreurs async, `req.query`, wildcard `*`). `@as-integrations/express4` à remplacer par l'intégration Express 5 d'Apollo. | P2 | L |
| `zod` **3.24.1** pinné (latest 4.6.5) | Pin exact + major de retard. Rappel convention repo : `zod` banni du back applicatif sauf `src/mcp/`. | Vérifier usages (`grep zod src --include=*.ts` hors `src/mcp/`) ; si usage legacy, migrer v4 ou supprimer au profit des guards maison. | P2 | M–L |
| `graphql` 16.14.2 → **17.0.2** | Major 17 dispo ; Apollo Server 5 + `graphql-tag` à qualifier. | Tester en L : monter `graphql` + `@apollo/server` ensemble, suite GraphQL complète. | P2 | L |
| `dotenv` 16.6.1 → **18.0.1** | 2 majors de retard. | `npm update dotenv`, vérifier chargement `.env` en dev/test/docker. | P2 | S–M |
| `mongoose` 9.8.1 → 9.10.1, `googleapis` 171.4.0 → 181.0.0, `puppeteer-core` 25.1.0 → 25.11.0, `pdfkit` 0.18.0 → 0.20.2 | Retard patch/minor, pas de CVE remontée. | `npm update mongoose googleapis puppeteer-core pdfkit`, tests ciblés (imports Drive, génération PDF). | P2 | M |
| `uuid` 11.1.1 → 14.0.2 (+ `overrides.uuid`) | 3 majors de retard ; l'`overrides` `$uuid` force une version unique — vérifier qu'il est toujours voulu. | Monter `uuid` (breaking ESM/imports à vérifier), conserver ou non l'override. | P3 | M |
| OpenTelemetry 0.221/0.69 → 0.222/0.70, `@opentelemetry/resources` 2.10 → 2.11 | Patchs mineurs. | `npm update @opentelemetry/*`, vérifier traces en dev. | P3 | S |
| `oxlint` 1.64 → 1.83, `prettier` 3.8.3 → 3.9.8, `typescript` 5.9 → 7.0, `@types/*` | Outillage dev en retard. `@types/node@20` vs Node réel à aligner. | Monter lint/format d'abord (S), TS major en dernier avec `npm run build`. | P3 | S–M |

- `overrides` back (`brace-expansion` ^5.0.8, `uuid`, `esbuild` ^0.28.1) : **efficaces** — `brace-expansion@5.0.9` dédupliqué partout, aucune CVE `brace-expansion`/`esbuild` remontée au back. À conserver, puis réévaluer après les updates.

## 2. Front (`front/disciplina-front/package.json`) — `npm audit` : 1 critical, 25 high, 31 moderate

| Package (installé → fix) | Pourquoi ça ne convient pas | Comment résoudre | Pri. | Cplx. |
|---|---|---|---|---|
| `pdfjs-dist` 3.11.174 + `@react-pdf-viewer/{core,default-layout}` **3.12.0** (2023) | **RCE** GHSA-wgrm-67xf-hhpq (8.8) : exécution JS via PDF malveillant. `fixAvailable: false` : le viewer 3.12 pingle `pdfjs` 3, **aucun patch possible sans changer de lib**. Toute la grappe `@react-pdf-viewer/*` (19 entrées high) en découle. | **Remplacer** : rendu custom sur `pdfjs-dist` v5/v6 **ou** lib maintenue ; en attendant, n'ouvrir que des PDF de confiance + `isEvalSupported: false`. | P0 | L |
| `react-router` **8.3.0** vs `react-router-dom` **7.18.2** | **Incohérence majeure** : `react-router-dom@7` dépend de `react-router@7.18.4` exact, mais `overrides` force `react-router@8.3.0` dedupé. Risque de comportement indéfini au runtime. `package.json` déclare `^8.3.0` + `^7.11.0` : les deux majors cohabitent. | Aligner : **recommandé `react-router` 8→7** (même major que `react-router-dom`, écosystème éprouvé) et retirer l'`overrides`. Alternative : tout passer en 8 (exige React ≥19.2.7, OK, mais v8 sortie sept. 2026, moins éprouvée). | P0 | M–L |
| `tar` ≤7.5.x → **critical** (transitive via `canvas` ← `pdfjs-dist`, `canvas` ← `@mapbox/node-pre-gyp`) | 6+ CVE path traversal / écrasement de fichiers (8.2–8.8). Chaîne : `pdfjs` → `canvas` (optionnel, inutile au navigateur) → `tar`. | Disparaît avec la migration PDF ci-dessus ; sinon `npm update` + exclusion `canvas` (dép. optionnelle non nécessaire au front). | P0 (transitive) | S–M |
| `dompurify` 3.4.12 → **3.4.15** | XSS GHSA-55q2-fjhq-7xh7 (`IN_PLACE` détaché exécutable). Pourtant imposé par les règles front (`cleanHtml` obligatoire). | `npm update dompurify` immédiat. | P1 | S |
| `@tiptap/*` 2.27.2 → **3.31.3** | GHSA-cp6q-959q-f8rh : `mergeAttributes()` transforme `__proto__` en attribut DOM exécutable (XSS, ~30 entrées moderate). Fix = **major 3**. À noter : `package.json` dit `^2.11.5` mais `2.27.2` installé — le `^` a déjà glissé, figer ou migrer. | Migration 2→3 (breaking : API extensions, CSS, ProseMirror) sur une branche dédiée + tests éditeur. | P1 | L |
| `brace-expansion` (override front **5.0.8**) | GHSA-rgw5-rvv9-x895 (DoS, 7.5) : range vulnérable `4.0.0–5.0.8`. L'`overrides` fige exactement la version vulnérable (back est en 5.0.9, sain). | Passer l'override à `^5.0.9` (ou le supprimer si plus nécessaire) + `npm update`. | P1 | S |
| `browserslist` ≤4.28.6, `baseline-browser-mapping`, `@humanfs/node`, `js-yaml` 4.0–4.3.1, `nanoid` <3.3.18 | CVE high/moderate transitives (OOM browserslist 7.5, DoS js-yaml 7.5, symlink humanfs, nanoid). Tirées par toolchain Vite/ESLint. | `npm update vite eslint typescript-eslint @playwright/test` (régénère le sous-arbre). | P1 | S |
| `lucide-react` 1.7.0 → **1.47.0** | 46 versions de retard, risque d'icônes renommées/supprimées à l'usage. | `npm update lucide-react`, contrôle visuel / snapshot. | P2 | M |
| `qrcode.react` **4.2.0** (déc. 2024, dernière release) | Plus de release depuis 2024, maintenance en sommeil. Pas de CVE, mais risque d'abandon. | Planifier migration vers `react-qr-code` (maintenu) ou geler en connaissance de cause. | P2 | M |
| `react`/`react-dom` 19.2.8 → 19.3.0, `vite` 8.0.16 → 8.3.0, `@vitejs/plugin-react`, `tailwindcss` 4.2.2 → 4.3.3, `recharts`, `react-hook-form`, `urql`, `@tanstack/react-query`, `@sentry/react`, `date-fns`, `postcss`, `globals` | Retards patch/minor sanctions courantes. `react-router@8` exige React ≥19.2.7 : toute décision router/React doit être conjointe. | `npm update` par vagues (React+Vite d'abord, puis libs), build + e2e Playwright. | P2–P3 | M |
| `@types/node` 24.x (latest 26.x), `typescript` 5.9.3 → 7.0.2, `eslint` 9 → 10, `@babel/core` 7 → 8 | Dette outillage. | Monter types/TS/ESLint après les vagues fonctionnelles. | P3 | M |

## 3. Ordre d'exécution recommandé

1. **Semaine 1 (P0/P1-S)** : back `multer → 2.4.0`, `express/qs`, `mysql2 → 3.24.4` ; front `dompurify → 3.4.15`, override `brace-expansion → ^5.0.9`, `npm update` toolchain (browserslist/js-yaml/nanoid). `npm audit` à 0 high côté back.
2. **Semaine 2 (P0 cohérence)** : aligner `react-router`/`react-router-dom` sur v7 + retirer l'`overrides` ; e2e Playwright complet.
3. **Chantiers L** (branches dédiées) : migration PDF (viewer), Tiptap 2→3, `pdf-parse` v1→v2, Express 4→5 (+ intégration Apollo v5), `exceljs` de remplacement, `zod` (auditer usages hors `src/mcp/`), `graphql` 17, `vitest` 5.

## 4. Notes de cadrage

- `zod` back : la CONVENTION l'interdit hors `src/mcp/` — l'audit Outdated le signale en retard, mais la première action est l'audit d'usage, pas l'update aveugle.
- Doublons PDF back (`pdf-parse` + `pdf-lib` + `pdfkit` + `puppeteer-core`) : rationaliser à l'occasion (surface + poids).
- `canvas`/`tar` front : purement transitifs du viewer PDF, aucun usage direct — ne pas patcher isolément, traiter via la migration PDF.

## 5. Proposition Dependabot (le repo n'en a aucun)

Créer `.github/dependabot.yml` (à valider, non appliqué dans cet audit) :

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/back"
    schedule: { interval: "weekly", day: "monday", time: "06:00", timezone: "Europe/Paris" }
    groups:
      otel: { patterns: ["@opentelemetry/*"] }
      tooling: { patterns: ["oxlint", "prettier", "typescript", "@types/*", "vitest", "@vitest/*"] }
    ignore:
      - dependency-name: "express"
        update-types: ["version-update:semver-major"] # migration 4->5 manuelle (cf. §1)
      - dependency-name: "graphql"
        update-types: ["version-update:semver-major"] # 16->17 manuelle
      - dependency-name: "zod"
        update-types: ["version-update:semver-major"] # usage à auditer (convention back)
    open-pull-requests-limit: 5
    labels: ["dependencies", "back"]
  - package-ecosystem: "npm"
    directory: "/front/disciplina-front"
    schedule: { interval: "weekly", day: "monday", time: "06:00", timezone: "Europe/Paris" }
    groups:
      tiptap: { patterns: ["@tiptap/*"] }
      tooling: { patterns: ["vite", "@vitejs/*", "eslint*", "typescript*", "tailwindcss", "@tailwindcss/*"] }
    ignore:
      - dependency-name: "@tiptap/*"
        update-types: ["version-update:semver-major"] # 2->3 manuelle (CVE suivie séparément)
      - dependency-name: "react-router"
        update-types: ["version-update:semver-major"] # alignement v7 manuel (cf. §2)
      - dependency-name: "pdfjs-dist"
        update-types: ["version-update:semver-major"] # migration viewer manuelle
      - dependency-name: "@react-pdf-viewer/*"
        update-types: ["version-update:semver-major"]
    open-pull-requests-limit: 5
    labels: ["dependencies", "front"]
```

- Activer aussi **Dependabot Security Updates** (alertes → PR auto) : couvre les P1-S (`multer`, `mysql2`, `dompurify`) sans attendre le passage hebdo.
- Alternative : Renovate si besoin de règles plus fines (range `pdfjs`, auto-merge patchs CI verte).

## 6. Correctifs S appliqués (2026-09-21)

- Back `npm audit` : 11 → **3** (restent uniquement `vitest`/`@vitest/*`, fix = major 5, dev-only, hors scope S). Corrigés : `multer` → 2.4.0, `express` → 4.22.3, `qs` → 6.16.0 (dedupe), `mysql2` → 3.24.x, `fast-uri`/`hono`/`nanoid` (patchés via updates), OTel, `oxlint`, `express-rate-limit`. `npm run lint` OK, `npm run build` OK.
- ⚠️ `npm update googleapis-common` (8.0.1 → 8.0.3) cassait `tsc` (double `google-auth-library` 10.5.0 niché) → **revert** à 8.0.1 (`--no-save`), build OK. Ne plus updater ce transitif isolément.
- Front `npm audit` : 57 → **50**. Corrigés : `dompurify` → 3.4.15, override `brace-expansion@^5` → `^5.0.9`, `browserslist`/`js-yaml`/`baseline-browser-mapping`/`humanfs`/`nanoid` (via `npm audit fix`). Restent : viewer/`pdfjs` (L), Tiptap (L), `react-router` (M). `npm run build` OK ; `npm run lint` rouge **pré-existant** (77 erreurs `no-explicit-any`, setState-in-effect… — code + config inchangés par ce fix, CI ne le lance pas).
- Back `npm test` non lancé : `sql-db` ne démarre pas (port hôte 3306 déjà occupé, conflit pré-existant).
- Fichiers touchés : `back/package-lock.json`, `front/disciplina-front/package.json` (override), `front/disciplina-front/package-lock.json`.

## 7. Chantier M — alignement react-router (2026-09-21)

- `react-router ^8.3.0` → `^7.18.4`, `react-router-dom ^7.11.0` → `^7.18.4`, overrides `react-router`/`react-router-dom` supprimés (seul `brace-expansion` reste).
- `npm ls` : `react-router-dom@7.18.4` → `react-router@7.18.4 deduped`, copie unique. Aucun import direct de `react-router` dans `src/` (46 imports tous via `react-router-dom`) → aucun changement de code.
- `npm run build` OK. Audit inchangé (50, le mismatch n'était pas une CVE). E2E Playwright restant à lancer (stack complète requise).

## 8. Chantier L — migration viewer PDF (2026-09-21)

- Retirés : `@react-pdf-viewer/core`, `@react-pdf-viewer/default-layout`, `pdfjs-dist@3.11.174` (RCE GHSA-wgrm-67xf-hhpq 8.8, `fixAvailable: false`).
- Ajoutés : `react-pdf@^11.0.0` (peers React 19 OK) + `pdfjs-dist@6.3.289` exact, dédupliqué en copie unique avec le nested de react-pdf.
- `src/components/rh/PdfViewer.tsx` réécrit : `<Document>/<Page>` canvas (propriété anti-iframe/JWT conservée), `options={{ cMapUrl, standardFontDataUrl, isEvalSupported: false }}`, toolbar maison (pages, zoom 50–300 %, plein écran, téléchargement) — recherche plein texte abandonnée (validé). Seul consommateur : `FicheCandidat.tsx:1826` (inchangé).
- `vite.config.ts` : `vite-plugin-static-copy@^4.1.1` (dev) copie `cmaps/` (169) + `standard_fonts/` (16) dans `dist/` — aucun CDN externe, prod offline OK. Worker bundlé `dist/assets/pdf.worker.min-*.mjs`, smoke `vite preview` : `200` sur index, cmaps, fonts.
- `npm run build` OK, `eslint` propre sur les 2 fichiers, `npm audit` : 50 → **28** (0 high, 0 critical ; reste Tiptap L + minors). E2E : aucune spec ne couvre le preview (17 specs existantes, à brancher cf. BACKLOG OPS-1/FE-7) — contrôle visuel manuel restant (Fiche candidat → aperçu CV).

## 9. Chantier L — Tiptap 2→3 (2026-09-21)

- Conflit peer (`@tiptap/*@3` exigent `@tiptap/pm@3.31.3` exact) résolu par `uninstall` complet du set v2 puis install v3 : `@tiptap/react`, `starter-kit`, `extension-underline`, `extension-text-align`, `extension-link`, `extensions` (nouveau), `pm` → **3.31.3**, arbre unique dédupliqué. `@tiptap/extension-placeholder` supprimé (remplacé par `{ Placeholder } from '@tiptap/extensions'`).
- `src/components/rh/../ui/RichTextEditor.tsx` (seul usage, 1 fichier) : import Placeholder migré + `setContent(value, false)` → `setContent(value, { emitUpdate: false })` (signature v3 `(content, options)`, émission d'updates par défaut — comportement anti-boucle conservé).
- `npm run build` OK, eslint : 1 warning pré-existant (`exhaustive-deps` sur le `useEffect` de sync, inchangé). **`npm audit` front : 28 → 0**. Contrôle visuel éditeur restant (aucune spec e2e).

## 10. Front 100 % — minors + majors (2026-09-21)

- Vague 1 (core) : `react`/`react-dom` 19.2.8→19.3.0 (+ `@types`), `@vitejs/plugin-react` 6.0.1→6.1.1, `zustand` 5.0.12→5.0.15, `@tanstack/react-query` 5.96.1→5.103.2, `urql` 5.0.2→5.0.4.
- Vague 2 (UI/data) : `@radix-ui/react-dialog`→1.1.23, `react-hook-form`→7.88.0, `recharts`→3.10.1, `date-fns`→4.4.0, `@sentry/react`→10.75.0, `tailwindcss`+`@tailwindcss/vite`→4.3.3, `autoprefixer`→10.6.1. `lucide-react` 1.7.0→1.47.0 vérifié : les ~110 icônes utilisés existent tous en 1.47. `qrcode.react` déjà au latest (4.2.0, rien à faire).
- Vague 3 (outillage) : `@playwright/test`→1.63.0, `@rolldown/plugin-babel`→0.2.4, `eslint-plugin-react-hooks`→7.1.1 (+0.5.7 refresh), `globals`→17.12.0, `@types/node` 24.12.0→26.6.2, `eslint` 9.39.5→10.11.0 (`@eslint/js`→10.0.1, flat config déjà en place), `@babel/core` 7.29.7→8.0.6 (peer OK avec `@rolldown/plugin-babel`), `typescript` 5.9.3→7.0.2 (+ fix `tsconfig.app.json` : `baseUrl` supprimé, `"@/*": ["./src/*"]` relativisé — TS 7 l'exige).
- Effet de bord : `eslint-plugin-react-hooks` 7.1 ajoute la règle `setState-in-effect` → ~+29 erreurs sur du code pré-existant (lint déjà rouge, CI ne le lance pas ; à traiter hors scope).
- État final front : `npm outdated` **vide**, `npm audit` **0**, `npm run build` **EXIT:0**.
