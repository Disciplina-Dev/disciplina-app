# E2E.md — Checklist de non-régression runtime (full-stack)

Ce document liste les **flux métier critiques** de Disciplina déroulés pendant l'exécution réelle de l'application (front → route/GraphQL → service → DB → external). Il sert de checklist manuelle pour vérifier, après un déploiement ou une évolution, qu'aucun parcours n'a régressé.

Ce n'est pas un fichier de tests exécutable : c'est un référentiel. Pour la philosophie des tests component automatisés, voir [`back/HOWTOTEST.md`](back/HOWTOTEST.md). La correspondance flux ↔ tests vitest est en [§5](#5-correspondance-flux--tests-automatisés-existants).

---

## 1. Mode d'emploi

**Quand dérouler** : avant un merge sur `prod`, après chaque déploiement, après une modification touchant l'auth, les serveurs GraphQL ou une intégration `external/`.

**Pré-requis runtime** :
```sh
docker compose up
```
Démarre la stack complète : `sql-db` (MySQL), `nosql-db` (MongoDB), `ollama`, backend sur `:4000`, frontend sur `:5173`.

**Convention de statut** (à reporter par scénario lors d'une passe) :

| Symbole | Signification |
|---|---|
| ✅ | Flux OK |
| ⚠️ | Dépend d'un service external (peut échouer sans que le code ait régressé) |
| ❌ | Régression constatée |

**Liveness** : il n'existe **pas d'endpoint `/health`** (voir [§6](#6-améliorations-proposées)). Le signal de vie le plus simple = un login réussi (flux 1) qui retourne un cookie de session.

---

## 2. Rôles × espaces front

Sources : `front/disciplina-front/src/store/authStore.ts`, `front/disciplina-front/src/router/index.tsx`, `back/src/types/user.types.ts`.

| Rôle | Espace front | Périmètre principal |
|---|---|---|
| `COMMERCIAL` | `/commercial` | Dashboard, KPI, Analyses de Besoin, portefeuille entreprises, blacklist, sourcing SIRET, relances, todos |
| `RH` | `/rh` | Candidats (liste/fiche/questionnaire), matching, calendrier, ABs reçues, relances, todos |
| `PEDA` (+ `AD`/`GESTION`) | `/peda` | Suivi absences, modèles de mail |
| `AD` / `GESTION` | `/admin` | CRUD utilisateurs, config Drive/secteurs |
| `ENTREPRISE` | `/entreprise` | Remplir Analyse de Besoin, gérer apprentis, RDV, profils matchés |
| Public (token/signature) | `/booking/:slug`, `/external/matching/:signature`, `/external/interview/:signature`, `/external/authenticate?sig=…`, `/external/cv-import/:signature` | Parcours invités sans compte |

---

## 3. Flux critiques

Gabarit de chaque bloc : **Préconditions · Étapes (UI) · Chaîne technique · Résultat attendu · External · Test vitest · Statut**.

Le « résultat attendu » vérifie les 3 portes de sortie AAAC ([`back/HOWTOTEST.md`](back/HOWTOTEST.md) §1) : (1) réponse HTTP, (2) état persisté relu via une autre requête API, (3) appel au service external.

---

### 3.1 Authentification

- **Préconditions** : un utilisateur existe en base (`users`, MySQL).
- **Étapes** : `LoginPage` (`:5173`) → saisir email/mot de passe → soumettre.
- **Chaîne** : `POST /api/auth/login` → `controller.login` → `UserService.login` (bcrypt compare + JWT). Pose des cookies httpOnly (access + refresh) + un cookie CSRF lisible en JS. Puis `GET /api/auth/me`, `POST /api/auth/refresh` (rotation du refresh token), `POST /api/auth/logout`.
- **Résultat attendu** : (1) 200, **aucun token dans le body** ; (2) `GET /me` avec le cookie retourne le profil ; `refresh` invalide l'ancien refresh token (réutilisation → session révoquée) ; (3) n/a.
- **External** : aucun.
- **Test vitest** : `rest/auth/__tests__/cookieAuth.test.ts`, `csrf.test.ts`, `passwordPolicy.test.ts`, `rateLimiter.test.ts` (429 après 10 requêtes), `sensitive-fields.test.ts`.
- **Statut** : _à remplir_

### 3.2 Google OAuth

- **Étapes** : bouton « Se connecter avec Google » → redirection Google → retour sur `GoogleAuthCallback`.
- **Chaîne** : `POST /api/auth/google/uri` → `googleOAuth.generateAuthUrl` ; callback `GET /auth/google` → `POST /api/auth/google/token` → `exchangeCode` ; `/google/status`, `/google/disconnect`.
- **Résultat attendu** : (1) URL d'auth générée avec `state` signé ; (3) échange du code → token stocké côté user.
- **External** : ⚠️ Google OAuth.
- **Test vitest** : aucun (gap).
- **Statut** : _à remplir_

### 3.3 Gestion candidats / fiche

- **Étapes** : RH → `ListeCandidats` (pagination, filtres, recherche) → ouvrir une `FicheCandidat` → modifier un champ → uploader un avatar.
- **Chaîne** : GraphQL `/api/graphql/candidates` — `candidatesPage`, `candidate`, `updateCandidate` → `CandidateRepository` (Mongo). REST `POST /api/candidates/:id/avatar` (validation MIME par contenu réel, pas par déclaration).
- **Résultat attendu** : (1) liste camelCase paginée, filtres (`tpType`, `status`, `drivingLicenseB`, `geographicMobility`, `desiredSectors`) et recherche `$text`/`$regex` fonctionnels ; (2) modif relue via `candidate(id)` ; avatar SVG/HTML déguisé/vide **refusé**.
- **External** : Google Drive (dossier candidat) pour `createCandidateDriveFolder`. ⚠️
- **Test vitest** : `graphql/candidate/__tests__/{query,mutation,history}.test.ts`, `rest/candidates/__tests__/avatarMime.test.ts`.
- **Statut** : _à remplir_

### 3.4 Sourcing SIRET

- **Étapes** : COMMERCIAL → `Sourcing` → recherche par SIREN/SIRET ou multicritères.
- **Chaîne** : `POST /api/sourcing/search`, `GET /api/sourcing/:siren`, `GET /api/sourcing/:siret`, `POST /api/sourcing/multicriteria` → `SourcingService` (INSEE Sirene + DuckDuckGo + scraper + Ollama). Court-circuite l'appel INSEE si le SIREN entier est blacklisté.
- **Résultat attendu** : (1) résultats enrichis ; branche blacklist correcte ; (3) appels INSEE/DDG/Ollama.
- **External** : ⚠️⚠️ INSEE + DDG + scraper + Ollama (blast radius large).
- **Test vitest** : `rest/sourcing/__tests__/searchBySiren.test.ts` (branches blacklist uniquement).
- **Statut** : _à remplir_

### 3.5 Analyse de Besoin (AB)

- **Étapes** : ENTREPRISE `FormulaireAB` ou COMMERCIAL `CreateAB` → remplir → soumettre ; générer le PDF.
- **Chaîne** : GraphQL `/api/graphql/needs-analysis` — `createNeedsAnalysis`, `updateNeedsAnalysis`, `needsAnalysesByCompany` → Mongo. PDF : `GET /api/needs-analysis/:id/pdf`, `/signature/mandat-pdf`, `/catalogue-pdf` → `NeedsAnalysisService` → `PdfService`.
- **Résultat attendu** : (1) AB persistée ; (2) relue via `needsAnalysesByCompany` ; PDF généré (content-type `application/pdf`).
- **External** : Drive (upload signé). ⚠️
- **Test vitest** : `graphql/needsAnalysis/__tests__/needsAnalysis.test.ts` (partiel).
- **Statut** : _à remplir_

### 3.6 Matching

- **Étapes** : RH → `Matching` → lancer un match sur une offre → ajouter/retirer des candidats → créer une session de match.
- **Chaîne** : GraphQL `/api/graphql/offers` — `matchOffer`, `addCandidateToOffer`, `removeCandidateFromOffer`, `updateMatchedCandidateStatus`, `createMatchSession(offerId, companyEmail, candidates)` → `MatchLinkService` / `MatchMailService` (lien signé + email Gmail). Offres/matches en Mongo.
- **Résultat attendu** : (1) candidats matchés retournés ; statut `MATCHED`/`NOT_MATCHED` cohérent ; (2) relu via `offer(id)` ; (3) email de match envoyé, session `external_access` reference 3 (entretien) créée + email d'invitation envoyé pour les candidats acceptés.
- **External** : ⚠️ Gmail.
- **Test vitest** : `graphql/offers/__tests__/{query,mutation}.test.ts`, `services/__tests__/MatchLinkService.test.ts`.
- **Statut** : _à remplir_

### 3.7 Comparateur public (match)

- **Étapes** : entreprise reçoit un lien `/external/authenticate?sig=…` → saisit le code 6 chiffres (envoyé au chargement) → inspect pose le cookie `disc_at` → redirection `/external/matching/:signature` → compare les profils → soumet ses réponses.
- **Chaîne** : `POST /api/external/inspect` (cookie `EXTERNAL_GUEST`), `GET /api/external/:signature/match/{candidates,cv/:candidateId,completion}`, `POST /:signature/match/answers` → `MatchAccessService` (`external_access` reference 2) + `MatchMailService`.
- **Résultat attendu** : signature inconnue rejetée ; après auth (cookie), candidats (avec consentement `data_sharing`) + CV accessibles ; réponses persistées (déclenche le flux entretien) ; session déjà finalisée → **409** ; re-soumettre une session COMPLETED → 409 sans changement.
- **External** : ⚠️ Gmail (code envoyé séparément au chargement + template `proposition_candidat` sans code/identifiant).
- **Test vitest** : `services/__tests__/MatchAccessService.test.ts`, `rest/external/__tests__/{matchCompleted,matchConsent}.test.ts`.

### 3.8 Entretiens

- **Étapes** : candidat accepté reçoit un email avec un lien `/external/authenticate?sig=…` → ouvre le lien → saisit le code 6 chiffres (envoyé au chargement) → cookie `disc_at` posé → redirection `/external/interview/:signature` → choisit un créneau → réserve.
- **Chaîne** : `POST /api/external/inspect` (cookie `EXTERNAL_GUEST`), `GET /api/external/:signature/interview/slots`, `POST /:signature/interview/book` → `ExternalInterviewService` (`external_access` reference 3 : offer = `external_id`, candidate = `reference_key`) + `InterviewMailService`. Occupation croisée agenda Google du RH (freebusy) + créneaux déjà réservés par d'autres candidats.
- **Résultat attendu** : (1) code correct → cookie, session déjà finalisée → **"Démarche déjà finalisée"** ; créneau déjà pris marqué occupé ; réservation d'un créneau libre → historique (candidat + offre) + notif RH `interview_booked` ; créneau pris/chevauchant une période occupée → **409 race-safe sous concurrence** ; re-réservation sur session `COMPLETED` → 409.
- **External** : ⚠️ Google Calendar.
- **Test vitest** : `rest/external/__tests__/interviewFlow.test.ts`, `services/__tests__/MatchAccessService.test.ts` (déclenchement), `services/__tests__/InterviewMailService.test.ts`.
- **Statut** : _à remplir_

### 3.9 Booking / calendrier

- **Étapes** : réglages de disponibilité (`GET/PUT /api/booking/settings`) ; parcours public `/booking/:slug` → choisir créneau → réserver ; calendrier interne.
- **Chaîne** : `GET /api/booking/public/:slug`, `/slots`, `POST /book` → `booking/service.ts`. Calendrier : `GET /api/calendar/users|events`, `POST /events`, `PATCH /events/:id`, `/events/:id/attendance`, `DELETE /events/:id` → `external/google/calendar.service.ts`.
- **Résultat attendu** : créneaux libres corrects ; réservation crée l'event Google Calendar.
- **External** : ⚠️ Google Calendar.
- **Test vitest** : aucun (gap).
- **Statut** : _à remplir_

### 3.10 E-signature AB

- **Étapes** : envoi d'une invitation de signature → l'entreprise signe → réception du webhook → archivage Drive.
- **Chaîne** : chemin **actif = DocuSeal** (`abSignatureTemplate` `{{lien_signature}}`, `SignedAbProcessor` télécharge le doc signé puis l'upload sur Drive). Yousign présent en secours. Webhooks : `POST /api/webhooks/docuseal`, `POST /api/webhooks/yousign` (+ SSE `/api/webhooks/yousign/stream`), signatures vérifiées par `webhookSignature.ts`.
- **Résultat attendu** : (1) webhook signé accepté (bare-hex ou `sha256=`), signature manquante/fausse → 401 ; (2) statut AB passe à `SIGNE` ; doc archivé sur Drive.
- **External** : ⚠️ DocuSeal, Yousign, Drive.
- **Test vitest** : `graphql/needsAnalysis/__tests__/needsAnalysis.test.ts` (webhook Yousign → `SIGNE`), `rest/middleware/__tests__/webhookSignature.test.ts`.
- **Statut** : _à remplir_

### 3.11 Email / relance

- **Étapes** : envoi d'un email ou d'une relance (mail/téléphone), relance bulk sur un lot d'entreprises, consultation de l'historique.
- **Chaîne** : `POST /api/email/send` (rate-limited), `POST /api/email/draft` → `ExternalMailService` → Gmail. Relance : `POST /api/relance/send`, `GET /api/relance/response`, `POST /api/relance/company/bulk`, `/company/:id/mail`, `/company/:id/phone`, `GET /company/:id/history` → `BulkRelanceService`, `ContactLogService`. Logs de contact en MySQL.
- **Résultat attendu** : (1) requête invalide → 400 **sans appeler Gmail** ; (3) email envoyé ; log de contact persisté et relu via l'historique.
- **External** : ⚠️ Gmail.
- **Test vitest** : aucun direct (le pattern mock Gmail est documenté dans HOWTOTEST §9).
- **Statut** : _à remplir_

### 3.12 Classmarker (tests candidats)

- **Étapes** : génération de liens de quiz → le candidat passe le test → webhook résultat.
- **Chaîne** : `GET /api/classmarker/links`, SSE `/api/classmarker/classmarker/stream` ; webhook résultat `POST /api/webhooks/...` → vérifie la signature, génère le PDF de résultat, l'upload sur le Drive du candidat, met à jour `CandidateModel` (Mongo).
- **Résultat attendu** : (1) webhook signé accepté, JSON invalide → 400 ; (2) score + PDF rattachés au candidat.
- **External** : ⚠️ ClassMarker, Drive.
- **Test vitest** : `rest/middleware/__tests__/webhookSignature.test.ts` (garde classmarker).
- **Statut** : _à remplir_

### 3.13 KPI commercial & RH

- **Étapes** : COMMERCIAL consulte son dashboard KPI ; RH consulte le rapport KPI.
- **Chaîne** : `GET /api/kpi/{users,years,live,activity,combined,overview,user/:id,summary,monthly,weekly}`, `POST /api/kpi`, `POST /api/kpi/import` → `KpiService`. RH : `GET /api/rh-kpi/{years,report}` → `RhKpiService`.
- **Résultat attendu** : agrégats corrects ; import CSV persiste les lignes.
- **External** : aucun.
- **Test vitest** : aucun (gap).
- **Statut** : _à remplir_

### 3.14 Peda / absences

- **Étapes** : PEDA configure le suivi (`GET/PUT/DELETE /api/peda/config*`) → lance une passe (`POST /api/peda/run`).
- **Chaîne** : `peda/controller.ts` → `PedaService`, `PedaDraftService` (lit Google Sheets, rédige des brouillons de relance d'absence). Scheduler en arrière-plan : `scheduler/pedaDraftScheduler.ts` + `immersionEndScheduler.ts` (`setInterval`, démarrés dans `startServer`).
- **Résultat attendu** : brouillons générés à partir des absences ; adresses email normalisées correctement.
- **External** : ⚠️ Google Sheets, Gmail.
- **Test vitest** : `services/__tests__/pedaDraftEmail.test.ts` (`normalizeEmail`), `services/__tests__/immersionEndNotification.test.ts`.
- **Statut** : _à remplir_

### 3.15 Notifications & Todos

- **Étapes** : réception de notifications temps réel ; création/consultation de todos.
- **Chaîne** : `GET /api/notifications`, `POST /read-all`, `/:id/read`, SSE `/api/notifications/stream` → `NotificationService`. GraphQL `/api/graphql/companies` — `myTodos`, `createTodo`, `changePassword`.
- **Résultat attendu** : SSE émet les notifs ; marquage lu persisté ; todos relus via `myTodos`.
- **External** : aucun.
- **Test vitest** : couverture partielle via `authBoundary.test.ts` (rejets SSE sans token/guest).
- **Statut** : _à remplir_

### 3.16 Admin utilisateurs

- **Étapes** : AD/GESTION → `/admin/utilisateurs` → créer un utilisateur (`RegisterPage`) → éditer un rôle/permission.
- **Chaîne** : `POST /api/auth/register`, `PATCH /api/auth/users/:id`, annuaire staff (`directory`).
- **Résultat attendu** : (1) mot de passe conforme à la politique exigé ; (2) user créé relu ; l'annuaire n'expose que `id/firstName/lastName/role/permission`, **jamais** emails/tokens/mots de passe.
- **External** : aucun.
- **Test vitest** : `rest/auth/__tests__/directory.test.ts`, `sensitive-fields.test.ts`.
- **Statut** : _à remplir_

---

## 4. Dépendances external & mode dégradé

Source : `back/src/external/*`, `back/src/config/env.ts`. Rappel : au démarrage, les seeds (modèles de mail) et les schedulers loggent leurs erreurs **sans être fatals** (`startServer`).

| External | Flux impactés | Si indisponible |
|---|---|---|
| **Google** (OAuth/Gmail/Drive/Sheets/Calendar) | 3.2, 3.3, 3.5, 3.6, 3.8, 3.9, 3.10, 3.11, 3.12, 3.14 | Blast radius maximal : login OAuth, tout mail, Drive, calendrier, Sheets tombent. App reste up. |
| **INSEE Sirene / géocodage** | 3.4 | Sourcing dégradé ; blacklist court-circuit reste OK. |
| **Ollama** (qwen2.5, docker) | 3.4 | Enrichissement sourcing indisponible. |
| **DDG + scraper** | 3.4 | Idem sourcing. |
| **Filiz** | Mapper candidat, `/api/filiz/*` | Diplômes/classes indisponibles. |
| **ClassMarker** | 3.12 | Liens/résultats de test indisponibles. |
| **Yousign** | 3.10 (secours) | Chemin secondaire ; DocuSeal reste le chemin actif. |
| **DocuSeal** | 3.10 (actif) | Signature AB bloquée. |

---

## 5. Correspondance flux ↔ tests automatisés existants

### Suite E2E Playwright (front → back → DB)

Les 16 flux sont désormais automatisés bout-en-bout par une suite **Playwright** dans [`front/disciplina-front/e2e/`](front/disciplina-front/e2e/README.md) (un `*.spec.ts` par flux, nommé d'après ce document). Prérequis : `docker compose up` (le seed `database/mysql/mysql-seed-e2e.sql` provisionne un compte par rôle). Lancement : `npm run test:e2e` (ou `test:e2e:ci` pour exclure les tests taggés `@external`). Complète les tests component vitest ci-dessous, ne les remplace pas.

### Tests component vitest

Tests component vitest (`back/src/**/__tests__/`), lancés par `npx vitest run` (DBs Docker requises). Voir [`back/HOWTOTEST.md`](back/HOWTOTEST.md).

| Flux | Couvert par | Gap |
|---|---|---|
| 3.1 Auth | `cookieAuth`, `csrf`, `passwordPolicy`, `rateLimiter`, `sensitive-fields` | — |
| 3.2 Google OAuth | — | **oui** |
| 3.3 Candidats | `candidate/{query,mutation,history}`, `avatarMime` | Drive folder |
| 3.4 Sourcing | `searchBySiren` (blacklist) | **flux complet INSEE/Ollama** |
| 3.5 AB | `needsAnalysis` (partiel) | **PDF** |
| 3.6 Matching | `offers/{query,mutation}`, `MatchLinkService` | — |
| 3.7 Comparateur public | `signers` (token) | **flux HTTP** |
| 3.8 Entretiens | `external/interview` | — |
| 3.9 Booking/calendrier | — | **oui** |
| 3.10 E-signature | `needsAnalysis`, `webhookSignature` | — |
| 3.11 Email/relance | (pattern documenté) | **oui** |
| 3.12 Classmarker | `webhookSignature` (garde) | flux PDF/Drive |
| 3.13 KPI | — | **oui** |
| 3.14 Peda | `pedaDraftEmail`, `immersionEndNotification` | flux `run` complet |
| 3.15 Notifs/Todos | `authBoundary` (SSE) | flux nominal |
| 3.16 Admin users | `directory`, `sensitive-fields` | — |

---

## 6. Améliorations proposées

1. **Endpoint `/health`** (readiness MySQL + Mongo) — absent aujourd'hui (`back/src/index.ts` n'expose ni `/health` ni `/ready`). Utile pour l'orchestration Docker et les scripts E2E. Faible coût, fort intérêt.
2. **Smoke test scriptable** — un script (Node/`fetch`) qui enchaîne : login → une requête sur chacun des 4 serveurs GraphQL → quelques endpoints REST clés. Réutilisable en CI post-déploiement pour valider la stack en < 30 s.
3. **Automatisation front E2E (Playwright)** — cibler `:5173` pour les parcours UI et publics non couverts par les tests component back (flux 3.7, 3.9, et les parcours navigateur de 3.1/3.3). Complète le back, ne le remplace pas.
4. **Combler les gaps [§5](#5-correspondance-flux--tests-automatisés-existants)** — prioriser des tests component (philosophie HOWTOTEST) pour sourcing complet, KPI, needs-analysis PDF, email/relance (avec mock Gmail au niveau `external/`).
