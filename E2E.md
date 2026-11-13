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
| `PEDA` (+ `AD`/`GESTION`) | `/peda` | Suivi absences, alternants, sessions, formateurs, ruptures, émargements, modèles de mail |
| `AD` / `GESTION` | `/admin` | CRUD utilisateurs, config Drive/secteurs |
| `ENTREPRISE` | `/entreprise` | Remplir Analyse de Besoin, gérer apprentis, RDV, profils matchés |
| `FORMATEUR` | `/formateur` | Intervenant externe : prochaine séance et compteurs. Compte créé par le Peda depuis la fiche formateur ; jamais staff (le front le renvoie dans son espace, le back refuse son jeton sur les routes internes) |
| Public (token/signature) | `/booking/:slug`, `/external/matching/:signature`, `/external/interview/:signature`, `/external/authenticate?sig=…`, `/external/cv-import/:signature` — les anciens liens `/public/{match,interview,cv-import}/:signature` (mails pré-migration) sont redirigés vers `/external/authenticate?sig=…` | Parcours invités sans compte |

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

- **Étapes** : entreprise reçoit un lien `/external/authenticate?sig=…` → ouvre le lien (lien magique sans code, expiration armée à J+7) → cookie `disc_at` posé → redirection `/external/matching/:signature` → compare les profils → soumet ses réponses.
- **Chaîne** : `POST /api/external/:signature/authenticate` (cookie `EXTERNAL_GUEST`), `GET /api/external/:signature/match/{candidates,cv/:candidateId,completion}`, `POST /:signature/match/answers` → `MatchAccessService` (`external_access` reference 2) + `MatchMailService`.
- **Résultat attendu** : signature inconnue rejetée (404), lien expiré → **410** ; création refusée si un candidat proposé n'a pas consenti au partage (`data_sharing`) — sinon la vue entreprise serait vide ; après auth (cookie), candidats (avec consentement `data_sharing`) + CV accessibles ; réponses persistées (déclenche le flux entretien) ; session déjà finalisée → **409** ; re-soumettre une session COMPLETED → 409 sans changement.
- **External** : ⚠️ Gmail (template `proposition_candidat` sans code/identifiant).
- **Test vitest** : `services/__tests__/MatchAccessService.test.ts`, `rest/external/__tests__/{matchCompleted,matchConsent}.test.ts`.

### 3.8 Entretiens

- **Étapes** : candidat accepté reçoit un email avec un lien `/external/authenticate?sig=…` → ouvre le lien (lien magique sans code, expiration armée à J+7) → cookie `disc_at` posé → redirection `/external/interview/:signature` → choisit un créneau → réserve.
- **Chaîne** : `POST /api/external/:signature/authenticate` (cookie `EXTERNAL_GUEST`), `GET /api/external/:signature/interview/slots`, `POST /:signature/interview/book` → `ExternalInterviewService` (`external_access` reference 3 : offer = `external_id`, candidate = `reference_key`) + `InterviewMailService`. Occupation croisée agenda Google du RH (freebusy) + créneaux déjà réservés par d'autres candidats.
- **Résultat attendu** : (1) lien valide → cookie, session déjà finalisée → **"Démarche déjà finalisée"** ; créneau déjà pris marqué occupé ; réservation d'un créneau libre → historique (candidat + offre) + notif RH `interview_booked` ; créneau pris/chevauchant une période occupée → **409 race-safe sous concurrence** ; re-réservation sur session `COMPLETED` → 409.
- **External** : ⚠️ Google Calendar.
- **Test vitest** : `rest/external/__tests__/interviewFlow.test.ts`, `services/__tests__/MatchAccessService.test.ts` (déclenchement), `services/__tests__/InterviewMailService.test.ts`.
- **Statut** : _à remplir_

### 3.9 Booking / calendrier

- **Étapes** : réglages de disponibilité (`GET/PUT /api/booking/settings`) ; parcours public `/booking/:slug` → choisir créneau → réserver ; calendrier interne.
- **Chaîne** : `GET /api/booking/public/:slug`, `/slots`, `POST /book` → `booking/service.ts`. Calendrier : `GET /api/calendar/users|events`, `POST /events`, `PATCH /events/:id`, `/events/:id/attendance`, `DELETE /events/:id` → `external/google/calendar.service.ts`.
- **Résultat attendu** : créneaux libres corrects ; réservation crée l'event Google Calendar. Recherche dans le calendrier RH par email **ou** nom/prénom de l'invité (champs optionnels à la création, absents des créneaux historiques → recherche email seule).
- **External** : ⚠️ Google Calendar.
- **Test vitest** : `rest/calendar/__tests__/events.test.ts` (authz secteur), `rest/calendar/__tests__/attendee.test.ts` (création + nom/prénom, rétro-compatibilité).
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

### 3.12 bis Questionnaires internes (remplacement ClassMarker, #968)

- **Étapes** : (1) RH importe un JSON (`/rh/questionnaires` → « Importer JSON », exemples dans `Classmarker/questions/jsons/`) ou crée par blocs, puis « Tester » ; (2) active le questionnaire ; (3) depuis la fiche candidat, génère le lien + QR ; (4) le candidat passe le test sur `/test/:token` (QCM, vrai/faux, réponse libre) ; (5) le RH suit la progression en direct, puis télécharge le PDF (fiche, Résultats ou détail du passage).
- **Chaîne** : `POST /api/questionnaires` (validation `questionnaireValidation`) → `POST /:id/invitations` → `GET/POST /api/q/:token[/start|/answer]` (`QuestionnaireAttemptService`, correction `questionnaireScoring`) → `TestResultService.saveTestResult` (fiche `classmarker` + SSE + PDF Drive best-effort) ; `GET /api/questionnaires/attempts/:id/pdf` (PDF sans Drive).
- **Résultat attendu** : (1) import invalide → 400 avec la liste des erreurs ; (4) bonne réponse jamais envoyée avant validation, pas de retour arrière, lien lié au 1er appareil ; réponse libre juste malgré casse/espaces/ponctuation, fausse si accent manquant ; (5) score sur la fiche en direct, PDF téléchargeable même sans compte Google ; questionnaire verrouillé après le 1er vrai passage.
- **External** : ⚠️ Drive (optionnel : dépôt du PDF seulement).
- **Test vitest** : `rest/questionnaire/__tests__/questionnaire.test.ts`.
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
- **Chaîne** : `peda/controller.ts` → `PedaService`, `PedaDraftService` (lit Google Sheets, rédige des brouillons de relance d'absence). Schedulers en arrière-plan : `scheduler/pedaDraftScheduler.ts` + `immersionEndScheduler.ts` + `saNotificationScheduler.ts` (`setInterval`, démarrés dans `startServer`).
- **Résultat attendu** : brouillons générés à partir des absences ; adresses email normalisées correctement ; notif Peda à la déclaration d'une rupture et au premier passage d'une SA « En cours » / « En retard ».
- **External** : ⚠️ Google Sheets, Gmail.
- **Test vitest** : `services/__tests__/pedaDraftEmail.test.ts` (`normalizeEmail`), `services/__tests__/immersionEndNotification.test.ts`, `services/__tests__/saNotification.test.ts` (SA en cours/en retard + notif rupture), `graphql/peda/__tests__/rupture.test.ts` (déclaration + rapport mensuel), `graphql/peda/__tests__/alternant.test.ts`, `graphql/peda/__tests__/session.test.ts`. Exposition MCP : voir 3.17.
- **Statut** : _à remplir_

### 3.14 bis Émargement des séances (#955)

- **Étapes** : (1) Peda crée une séance depuis `/peda/emargements` (session, date, horaires de cours du matin et de l'après-midi — la pause déjeuner entre les deux n'est pas comptée —, site, salle ou distanciel, module/séquence et lieu précis facultatifs, formateur, fenêtres de signature matin/après-midi) ; le formateur reçoit l'invitation ; (2) il ouvre `/emargement/formateur/:token`, corrige les statuts (N/A, présent, absent, en retard/heure, parti en avance/heure) et affiche le QR code ; (3) les alternants scannent le QR → `/emargement/sign/:token`, saisissent leur e-mail, tracent leur signature et confirment ; (4) à la fermeture du créneau du matin, le formateur coche la certification, trace sa signature et signe la demi-journée du matin (elle est verrouillée, l'après-midi reste modifiable) ; il signe de même l'après-midi après la fermeture de son créneau ; (5) si le lien expire avant la signature, la feuille passe en anomalie et le Peda la valide lui-même avec un motif ; (6) le Peda ouvre la feuille et consulte l'historique en bas de page : chaque changement de statut, signature et validation y figure avec son auteur et son horodatage.
- **Chaîne** : `POST/GET/PUT/DELETE /api/emargement/seances…` et `POST /api/emargement/seances/:id/validate` (`authenticate` + rôle PEDA/AD/GESTION) → `EmargementService` → `SeanceRepository`/`EmargementRepository` (Mongo `seances`/`emargements`) ; pages publiques `GET|POST /api/emargement/formateur/:token[/attendance|/attendance/sign|/sign]` et `GET|POST /api/emargement/sign/:token` (jeton HMAC `<seanceId>.<hmac>:<region>`, sans session CRM).
- **Résultat attendu** : (1) invitation envoyée, liens formateur et QR distincts ; si aucune boîte Google n'est connectée (ni `dev@disciplina.re` ni le compte du Peda), la séance est créée mais l'API renvoie `inviteSent: false` et l'écran affiche un avertissement avec le lien formateur à transmettre ; (2) seules les demi-journées existantes sont éditables, IP/user-agent lus côté serveur, aucun e-mail d'alternant renvoyé à la page formateur ; (3) hors fenêtre → 409 `window`, lien expiré → 410, e-mail inconnu → 404, signature idempotente, tracé obligatoire (absent → 400 `signature`) et conservé sur la feuille pour les exports ; les créneaux doivent tenir dans les horaires de cours de leur demi-journée (ouverture avant le début ou fermeture après la fin → 400 `validation`, créneau de l'après-midi sans cours l'après-midi → 400), et la signature de l'alternant se ferme à la fin de son créneau ; (4) signer une demi-journée avant la fermeture de son créneau → 409 `window` ; chaque signature ne verrouille que sa demi-journée (éditer une demi-journée validée → 409 `signed`, l'autre reste éditable) ; rejouer la signature d'une demi-journée déjà signée → 409 `signed` ; une feuille dont une demi-journée est validée ne se modifie plus (409) mais reste supprimable (200), la confirmation rappelant que statuts, signatures et journal sont alors perdus ; (5) statut calculé : « en cours » tant qu'un créneau n'est pas fermé, « à valider » créneaux fermés, « anomalie » lien expiré avec une demi-journée non signée (visible via `?validation=anomaly` et l'alerte de la liste), « validée » quand toutes les demi-journées le sont ; la validation Peda exige un motif (absent → 400 `validation`), refuse une feuille déjà validée ou aux créneaux non fermés (409), remplit les demi-journées manquantes en `source: 'peda'` sans tracé et conserve l'auteur + le motif ; (6) en-tête de la feuille : logo + nom de l'organisme, titre professionnel (snapshot de la filière Filiz), module/séquence, site + lieu, et financeur de chaque alternant (saisi sur sa fiche) — `null` tant qu'ils ne sont pas renseignés ; (7) après minuit, le lien formateur reste utilisable 7 jours (régularisation, signature des demi-journées) tandis que le QR alternant reste fermé ; (8) signature de secours : le formateur ouvre le pad depuis la ligne de l'alternant, l'alternant trace à la main → statut « présent » avec mode `handwritten`, tracé affiché sur la page formateur et sur la feuille Peda, effacé si l'alternant signe ensuite par QR ou si la ligne repasse à « absent » ; signature absente → 400 `signature`, créneau inexistant → 400 `window` ; (9) historique : la création de la feuille, chaque statut saisi ou corrigé (avec statut avant → après et heure), chaque signature (QR ou tracée) et chaque validation de demi-journée apparaissent dans `history` du détail, du plus récent au plus ancien, avec l'auteur ; une réécriture identique n'ajoute pas d'entrée, une écriture refusée (409) non plus, et supprimer la séance supprime son historique.
- **External** : ⚠️ Gmail (`sendSystemEmail`, repli sur le compte Google du Peda si la boîte système n'est pas connectée).
- **Test vitest** : `rest/emargement/__tests__/emargement.test.ts`.
- **Statut** : _à remplir_

### 3.14 ter Exports et justificatifs d'émargement (#955, §8)

- **Étapes** : (1) Peda → `/peda/emargements/:id` → carte « Exports » : choisir une charte (Disciplina, Région Réunion, FSE+) puis télécharger la feuille d'émargement (PDF), le récapitulatif du groupe (PDF), une attestation d'assiduité par alternant (PDF, sélecteur), les présences en CSV ou en Excel, et le journal d'audit en CSV ; (2) depuis la liste `/peda/emargements`, les boutons « Présences CSV / Excel » exportent la période affichée (filtre À venir / Passées / Toutes) ; (3) ouvrir les fichiers téléchargés : feuille PDF (tableau des présences avec signatures, blocs de signature du formateur, état de la feuille), attestation (identité, formation, période, heures prévues / réalisées, taux, détail des séances, zone de signature), CSV dans Excel français, classeur à deux feuilles (Présences + Synthèse), journal (horodatage, action, auteur, statut avant → après, motif).
- **Chaîne** : `GET /api/emargement/seances/:id/pdf`, `GET /api/emargement/exports/attendance` (`seanceId` / `sessionId` / `from` / `to`, `format=csv` ou `xlsx`), `GET /api/emargement/exports/history`, `GET /api/emargement/attestations/:alternantId?from&to`, `GET /api/emargement/sessions/:sessionId/attendance.pdf` (`authenticate` + rôle PEDA/AD/GESTION) → `EmargementService` (DTO : heures calculées, validations) → `EmargementExportService` (pdfkit, `ExcelJS`, CSV BOM + `;`) → pièce jointe HTTP.
- **Résultat attendu** : (1) cinq téléchargements nommés en UTF-8 (`filename*=UTF-8''`), `application/pdf`, `text/csv; charset=utf-8` ou `spreadsheetml` ; (2) PDF de séance : mentions de la charte choisie (couleur + bandeau + pied de page), colonne « Après-midi » masquée quand la séance n'a pas de créneau, tracé des alternants intégré, mention explicite pour une demi-journée validée par le Peda (avec motif) ou non signée à la date d'édition ; (3) heures : `présent` = demi-journée de cours entière, `en retard` = heure d'arrivée → fin des cours, `parti en avance` = début des cours → heure de départ, `absent` / N/A = 0, heure manquante = demi-journée entière ; la pause déjeuner (12:30 → 13:30 par défaut) n'est jamais comptée et les séances antérieures au lot 8 gardent leurs créneaux comme horaires ; (4) CSV : BOM UTF-8 (les octets `efbbbf` sont présents) et séparateur `;`, heures décimales à virgule ; Excel : feuille « Présences » filtrable + feuille « Synthèse » (heures, taux, absences, séances) ; (5) exports refusés sans session (401) et séance inconnue → 404 ; aucun fichier n'est écrit sur le serveur ni envoyé par e-mail, et les routes publiques (formateur / QR) n'y donnent pas accès.
- **External** : aucun.
- **Test vitest** : `rest/emargement/__tests__/emargement.test.ts` (« exporte la feuille en PDF, les présences en CSV/Excel, le journal et une attestation », « refuse les exports sans authentification et les séances inconnues »).
- **Statut** : _à remplir_

### 3.14 quater Assiduité, feuilles incomplètes et archivage (#955, §7)

- **Étapes** : (1) Peda → `/peda/assiduite` : période (mois courant par défaut), groupe et site optionnels, puis lecture des tuiles (alternants, séances, heures prévues / réalisées, taux, demi-journées non renseignées) et des trois onglets Alternants / Groupes / Sites ; export CSV ou Excel de la période depuis l'en-tête, récapitulatif PDF du groupe quand un groupe est sélectionné ; (2) le tableau de bord `/peda/dashboard` affiche le bandeau « Assiduité du mois » (taux, heures réalisées, alternants sous 80 %, demi-journées sans statut) avec un lien vers le détail ; (3) fiche alternant → carte « Assiduité » : taux, heures, absences, demi-journées non renseignées, détail séance par séance dépliable, bouton « Attestation PDF » ; (4) liste `/peda/emargements` → bouton « Statuts manquants » : ne restent que les feuilles dont une demi-journée **fermée** n'a pas de statut, avec un badge de compteur ; ouvrir la feuille → badge « N statuts manquants » à côté du titre des alternants ; (5) déclarer une rupture « quitte la formation » (module Ruptures, date d'effet renseignée) puis rouvrir une feuille postérieure : l'alternant n'y figure plus, mais il apparaît sur ses feuilles antérieures avec un badge « Archivé — rupture le JJ/MM/AAAA » ; une rupture « poursuit la formation » laisse l'alternant attendu avec la mention correspondante ; (6) cocher « Inclure les alternants sortis de la formation » avant d'exporter : le sorti revient dans le CSV/Excel avec sa colonne « Situation » et sa date d'effet.
- **Chaîne** : `GET /api/emargement/assiduite` (`from` / `to` / `sessionId` / `site`) et `GET /api/emargement/assiduite/:alternantId?from&to` → `EmargementService.assiduite` / `assiduiteAlternant` (dérivés de `exportAttendance`, `sessionRosters`, `presenceOf`) → `RuptureRepository.findByAlternantIds` ; `GET /api/emargement/seances?missing=1` → `SeanceListFilter.missing` + `attendanceProgress` (`EmargementRepository.countsBySeanceAndHalf`) ; `includeArchived=1` sur `GET /api/emargement/exports/attendance`.
- **Résultat attendu** : (1) taux = heures réalisées ÷ heures prévues sur les horaires de cours (pause déjeuner exclue : `présent` = toute la demi-journée, `en retard` = arrivée → fin, `parti en avance` = début → départ, `absent` / N/A = 0) ; une demi-journée **non renseignée** n'est pas comptée comme une absence : elle apparaît dans « Non renseignées » et déclenche l'alerte « le taux est sous-évalué » ; (2) mêmes chiffres sur la page, dans le bandeau du dashboard, la fiche alternant, l'attestation PDF et les exports — un seul calcul les produit ; (3) les onglets Groupes et Sites agrègent les mêmes lignes (un alternant présent dans deux sessions est compté dans chacune) ; (4) une feuille dont tous les statuts des créneaux fermés sont saisis sort de la liste « Statuts manquants » ; saisir un seul statut sur deux laisse la feuille incomplète ; (5) un archivé n'apparaît pas sur une séance postérieure à sa date d'effet (date de la rupture déclarée pour une sortie par rupture, date d'archivage pour une fin de formation) et reste sur les séances antérieures ; une rupture qui poursuit la formation n'exclut personne ; (6) `includeArchived` est le seul moyen de faire réapparaître un sorti, avec la mention « Archivé — … » datée ; sans lui, sa ligne serait un faux « absent » après son départ ; (7) routes protégées : sans session → 401, alternant inconnu → 404.
- **External** : aucun.
- **Test vitest** : `rest/emargement/__tests__/emargement.test.ts` (« agrège l’assiduité par alternant, par session et par site sur une période », « liste les feuilles incomplètes et compte les statuts manquants sur les créneaux fermés », « sort les archivés de la feuille, distingue la rupture qui poursuit et les inclut sur demande », « compte une demi-journée non renseignée sans la confondre avec une absence », « calcule les heures sur les horaires de cours, pause déjeuner exclue », « exige les horaires de cours de l’après-midi avec un créneau l’après-midi »).
- **Statut** : _à remplir_

### 3.14 quinquies Annuaire des formateurs (#955)

- **Étapes** : (1) Peda → `/peda/formateurs` → « Nouveau formateur » : nom et e-mail obligatoires, téléphone et commentaire facultatifs ; (2) cliquer une fiche : résumé (nombre de séances, heures de cours, sessions, période), coordonnées, sessions animées, historique des séances et journal des saisies ; (3) créer une séance depuis `/peda/emargements` → bloc « Formateur » : rechercher un formateur existant (nom ou e-mail) et le sélectionner (nom + e-mail recopiés), ou saisir un nom/e-mail inconnu — la fiche est créée automatiquement à l'enregistrement ; (4) sur la fiche, « Feuille » ouvre directement la feuille d'émargement de la séance ; (5) ajouter une note Peda : elle apparaît en tête du journal, sans modifier les coordonnées.
- **Chaîne** : `GET|POST /api/formateurs`, `GET|PUT /api/formateurs/:id`, `POST /api/formateurs/:id/notes` (`authenticate` + rôle PEDA/AD/GESTION) → `FormateurService` → `FormateurRepository`/`FormateurHistoryRepository` (Mongo `formateurs` / `formateur_history`) et `SeanceRepository.findByFormateur` / `findAllForStats` ; `formateurId` accepté par `POST|PUT /api/emargement/seances…` → `FormateurService.resolveForSeance` (création automatique si l'e-mail est inconnu).
- **Résultat attendu** : (1) e-mail normalisé en minuscules, doublon refusé (409 `email`), e-mail invalide ou nom absent → 400 `validation` ; (2) heures affichées = somme des horaires de cours des séances (matin + après-midi, pause déjeuner exclue) ; les séances antérieures à l'annuaire (sans `formateur_id`) sont rattachées par e-mail normalisé et comptent dans les mêmes totaux ; (3) sélectionner une fiche existante lie la séance (le snapshot nom/e-mail de la feuille vient de l'annuaire), saisir une adresse inconnue crée la fiche sans doublon et sans bloquer la séance ; modifier manuellement le nom ou l'e-mail dans le formulaire délie la fiche et repasse par le rattachement par e-mail ; (4) une modification ne journalise que les champs réellement changés (valeur avant → après), une réécriture identique n'ajoute rien, et une note est append-only (jamais modifiable ni supprimable) ; (5) sans session → 401, fiche inconnue → 404, suppression d'une séance ne supprime pas la fiche formateur.
- **External** : aucun.
- **Test vitest** : `rest/formateurs/__tests__/formateurs.test.ts`.
- **Statut** : _à remplir_

### 3.14 sexies Espace formateur — compte et tableau de bord (#1185)

- **Étapes** : (1) Peda → `/peda/formateurs/:id` → carte « Accès à l'espace formateur » : saisir un mot de passe (12 caractères minimum, majuscule, minuscule, chiffre) puis « Créer le compte » ; (2) ouvrir la page d'accueil `/` dans un autre navigateur, se connecter avec l'e-mail de la fiche et ce mot de passe → arrivée directe sur `/formateur` ; (3) vérifier le tableau de bord : compteurs « séances à venir » / « séances passées » et carte « prochain créneau » (date, horaires, durée, session, module, site) ; (4) revenir sur la fiche et cliquer « Mot de passe » puis enregistrer un nouveau secret : les appareils déjà connectés sont déconnectés et la connexion n'accepte plus que le nouveau ; (5) « Retirer l'accès » : le formateur ne peut plus se connecter mais la fiche, ses séances et son journal restent ; (6) « Supprimer la fiche » : confirmation explicite, la fiche disparaît de la liste, le compte est désactivé et les séances restent lisibles.
- **Chaîne** : `POST|PUT|DELETE /api/formateurs/:id/account`, `DELETE /api/formateurs/:id` (`authenticate` + rôle PEDA/AD/GESTION) → `FormateurService.createAccount` / `resetAccountPassword` / `deleteAccount` / `remove` → `UserService.register|updateUser|revokeAllSessions` (`users`, rôle `FORMATEUR` id 7, permission `EMPLOYEE`) et `UserDeletionService.deleteUser` (soft delete) ; `SeanceRepository.unlinkFormateur` ; côté formateur `GET /api/formateur/me` (`authenticateAny` + `requireRoles('FORMATEUR')`) → `FormateurService.dashboardForUser` → `FormateurRepository.findByUserId` (Mongo `formateurs.user_id`) + `SeanceRepository.findByFormateur`.
- **Résultat attendu** : (1) mot de passe faible → 400 `validation`, second compte sur la même fiche → 409 `account_exists`, e-mail déjà pris par un autre compte → 409 `email` ; la création journalise `account_created` ; (2) la connexion renvoie `role: 'FORMATEUR'`, `permission: 'EMPLOYEE'`, et le front redirige vers `/formateur` ; (3) « à venir » inclut aujourd'hui, calculé dans le fuseau du tenant ; fiche résolue par `req.user.id` exclusivement — un compte sans fiche rattachée reçoit 403 `no_formateur`, et un jeton `FORMATEUR` reçoit 403 sur **toutes** les routes staff (`/api/auth/users`, `/api/auth/directory`, `/api/formateurs`, `/api/emargement/seances`) alors que `/api/auth/me` et `/api/auth/logout` l'acceptent ; les quatre serveurs GraphQL (`jwtContext`) et MCP (`mcpAuth`, consentement OAuth) le rejettent aussi (réponse GraphQL en erreur `Unauthorized`, MCP 401, consentement refusé) ; (4) le nouveau mot de passe seul fonctionne, l'ancien tombe à 401, `account_password_reset` est journalisé et les refresh tokens du compte sont révoqués ; (5) connexion refusée (401), `account_deleted` journalisé, la fiche est intacte ; (6) 204, fiche inaccessible (404), `formateur_deleted` journalisé, `seances.formateur_id` remis à `null` (le rattachement par e-mail reprend la main) et `formateur_history` conservé ; (7) les comptes `FORMATEUR` n'apparaissent ni dans `/api/auth/users`, ni dans `/api/auth/directory`, ni dans l'annuaire MCP ; (8) la suppression puis la recréation d'un compte sur le même e-mail réactive la ligne `users` soft-deleted au lieu d'échouer sur la contrainte d'unicité.
- **External** : aucun (pas d'e-mail d'invitation dans ce lot : le Peda transmet les identifiants).
- **Test vitest** : `rest/formateurs/__tests__/formateurAccount.test.ts`.
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

### 3.17 MCP péda (lecture, RGPD)

- **Étapes** : client LLM authentifié (OAuth ou clé statique) → `POST /api/mcp` → outils `list_sessions`, `get_session`, `session_stats`, `list_sequences_overdue`, `list_sequences_upcoming`, `list_alternant_sequences`, `list_alternants`, `get_alternant`, `list_ruptures`, `rupture_stats`, `peda_kpi_overview`, `peda_draft_stats`.
- **Chaîne** : `mcp/tools/peda.ts` → `readTool` (scope, quota, `mcp_audit_log`) → services péda → `mcp/pedaExposure.ts` (consentement `ai_processing` via `candidate_id`, « Prénom N. », masquage k<`PEDA_MIN_GROUP`).
- **Résultat attendu** : alternants sans consentement ou sans candidat lié absents ; aucun email/téléphone/tuteur ; agrégats de 1 à 4 masqués sans déduction par soustraction ; notifications `peda`/`candidate` masquées.
- **External** : aucun.
- **Test vitest** : `mcp/__tests__/peda.test.ts`, `mcp/__tests__/pedaMasking.test.ts`.
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
| **ClassMarker** | 3.12 | Liens/résultats de test indisponibles. Les questionnaires internes (3.12 bis) n'en dépendent pas. |
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
| 3.12 bis Questionnaires internes | `questionnaire` (import, parcours complet, expiration, réponse libre, PDF, effacement) | dépôt Drive, SSE fiche |
| 3.13 KPI | — | **oui** |
| 3.14 Peda | `pedaDraftEmail`, `immersionEndNotification`, `saNotification`, `rupture`, `alternant`, `session` | flux `run` complet (drafts) |
| 3.14 bis Émargement | `emargement` (création + invitation, saisie formateur, QR idempotent, fenêtre fermée, feuille verrouillée) | invitation Gmail |
| 3.14 ter Exports émargement | `emargement` (PDF séance/attestation/groupe, CSV/Excel, journal) | — |
| 3.14 quater Assiduité émargement | `emargement` (agrégats alternant/groupe/site, fiche alternant, feuilles incomplètes, archivage et export historique) | — |
| 3.14 quinquies Formateurs | `formateurs` (CRUD, auto-création depuis une séance, statistiques, journal/notes) | — |
| 3.14 sexies Espace formateur | `formateurAccount` (compte créé/réinitialisé/retiré depuis la fiche, connexion `FORMATEUR`, cloisonnement staff, tableau de bord, suppression de fiche) | — |
| 3.17 MCP péda | `mcp/peda`, `mcp/pedaMasking` | — |
| 3.15 Notifs/Todos | `authBoundary` (SSE) | flux nominal |
| 3.16 Admin users | `directory`, `sensitive-fields` | — |

---

## 6. Améliorations proposées

1. **Endpoint `/health`** (readiness MySQL + Mongo) — absent aujourd'hui (`back/src/index.ts` n'expose ni `/health` ni `/ready`). Utile pour l'orchestration Docker et les scripts E2E. Faible coût, fort intérêt.
2. **Smoke test scriptable** — un script (Node/`fetch`) qui enchaîne : login → une requête sur chacun des 4 serveurs GraphQL → quelques endpoints REST clés. Réutilisable en CI post-déploiement pour valider la stack en < 30 s.
3. **Automatisation front E2E (Playwright)** — cibler `:5173` pour les parcours UI et publics non couverts par les tests component back (flux 3.7, 3.9, et les parcours navigateur de 3.1/3.3). Complète le back, ne le remplace pas.
4. **Combler les gaps [§5](#5-correspondance-flux--tests-automatisés-existants)** — prioriser des tests component (philosophie HOWTOTEST) pour sourcing complet, KPI, needs-analysis PDF, email/relance (avec mock Gmail au niveau `external/`).
