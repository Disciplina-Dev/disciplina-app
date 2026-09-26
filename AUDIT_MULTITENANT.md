# AUDIT MULTI-TENANT — Spécificités « La Réunion » bloquantes pour le tenant `annemasse`

Audit **lecture seule** du dépôt (`back/`, `front/disciplina-front/`, `database/`, `scripts/`, `docs/`).
Aucun code modifié. Toutes les constats sont référencés `fichier:ligne` et ont été revérifiés dans le code.

- **Tenants** : `reunion` (La Réunion, 974) et `annemasse` (Haute-Savoie, 74)
- **Date** : 2026-09-26
- **Documents liés** : `BACKLOG.md` (`DB-12`, `API-6`, `FE-3`), `docs/legal_mention_to_complete.md`, `RGPD.md`, `HOWTODEPLOY.md`

> **Statut d'application.** L'audit est né en lecture seule, mais le **Lot 1 (`TZ-*`) est
> maintenant implémenté** : `TZ-01` à `TZ-05`, `TZ-07` et `TZ-08` sont corrigés, `TZ-06` est acté
> hors périmètre. Le détail des correctifs est en §4.1.a et §7 ; le reste du document décrit
> l'état **antérieur** à correction et sert de référence pour les lots 2 (`ID-*`) et 3 (`GEO-*`),
> qui restent ouverts.


Légende sévérité :
**BLOQUANT** = l'utilisateur Annemasse ne peut pas terminer le flux, ou une donnée est silencieusement fausse dans une décision métier ·
**COSMÉTIQUE** = mauvais libellé / mauvaise adresse affichée, pas de rupture fonctionnelle ·
**DETTE** = défaut latent, valeur par défaut fausse, ou duplication de source de vérité.

---

## 1. Causes racines

Six causes expliquent la totalité des 80+ constats. Les traiter dans cet ordre.

### 1.1 Aucun profil tenant

Rien dans le schéma ne porte, par tenant : raison sociale, forme juridique, capital, SIRET, RCS, TVA, NDA, UAI, Qualiopi, adresse du siège, hébergeur, téléphone, email, contacts, URL publique, fuseau, logo, catalogue PDF.

La seule table tenant-editable est `sector_settings` (`back/src/repositories/mysql/SectorSettingsRepository.ts`) — et elle est pré-remplie avec des valeurs Réunion.

Conséquence : tout ce qui doit être imprimé ou envoyé (PDF, mail, page légale) lit une constante de code.

### 1.2 Vocabulaire géographique figé en énumérations globales

| Énumération | Valeurs | Définition |
|---|---|---|
| `Sector` (métier) | `Nord-Est` \| `Ouest` \| `Sud` | `back/src/utils/sector.ts:10` |
| `CompanyRegion` / `Zone` (brut) | `NORD` \| `OUEST` \| `SUD` | `back/src/types/needsAnalysisNoSql.types.ts:4` |
| `TrainingSite` | `NORD_SAINTE_MARIE` \| `OUEST_SAINT_PAUL` \| `SUD_SAINT_PIERRE` | `back/src/types/candidate.types.ts:34` |
| `KpiSite` | `NORD` \| `OUEST` \| `SUD` | `back/src/types/kpi.types.ts:1` |
| `Localisation` | 26 communes Réunion | `back/src/types/matching.types.ts:47` |

Ces énumérations sont **validées au niveau Mongo pour les deux tenants** (`back/src/db/mongo/schemas/candidate.schema.ts:194`, `position.schema.ts:18`, `offer.schema.ts:12`, `needsAnalysis.schema.ts:26`). Il n'existe pas d'axe tenant dans le modèle. Note : il n'y a pas de secteur `EST` — le libellé `Nord-Est` est uneConvention réunionnaise (les communes de l'Est sont repliées dans `NORD`).

### 1.3 Configuration d'URL process-global

`APP_BASE_URL` et `FRONTEND_BASE_URL` (`back/src/config/env.ts:98-99`) sont des variables d'environnement uniques. **Une seule instance backend ne peut pas produire un lien différent par tenant**, alors que 9 points d'émission de liens existent (§4.4).

### 1.4 Documents binaires statiques porteurs de l'identité Réunion

`back/assets/Mandat pour la publication d'une offre d'emploi (1).pdf` et `back/assets/Catalogue Disciplina.pdf` sont figés côté émetteur et injectés dans les enveloppes DocuSeal (`back/src/external/docuseal/docuseal.service.ts:49-55,85-92`, attachés depuis `NeedsAnalysisService:349`).

### 1.5 Corpus légal = un seul jeu de fichiers Markdown partagé

`front/disciplina-front/src/content/legal/*.md` rendu sans substitution (`front/disciplina-front/src/components/legal/LegalDocument.tsx`), sur des routes **publiques et sans authentification** (`front/disciplina-front/src/router/index.tsx:247-269`) et **sans garde de région**.

### 1.6 Fuseaux horaires jamais centralisés

Le fuseau n'a jamais été centralisé : `Indian/Reunion` en dur à 3 endroits, `Europe/Paris` en dur à 1 autre endroit. Le seul endroit qui a bien résolu le sujet est le scheduler PEDA.

---

## 2. Ce qui est déjà correct (ne pas re-flagger au prochain audit)

| Emplacement | Pourquoi c'est bon |
|---|---|
| `back/src/types/tenant.ts:1-3` | Union `Region` + `VALID_REGIONS` + `isRegion` |
| `back/src/db/tenant.ts:6-40` | Routage ALS `withRegion` / `getRegion` / `runForAllRegions`, suffixage de signature externe |
| `back/src/db/mysql/connection.ts:59-76` | Deux pools, `getPool(region)` |
| `back/src/db/mongo/tenant.ts:17-29` | Enregistrement des modèles par tenant |
| `back/src/rest/external/region.ts` | Signature suffixée → région |
| `back/src/scheduler/pedaDraftScheduler.ts:12-15` | **Modèle de référence** : `{ reunion: 'Indian/Reunion', annemasse: 'Europe/Paris' }` |
| `back/src/mcp/oauth/consentPage.ts:11-14` | Libellés et couleurs par région |
| `back/src/mcp/**` | Aucun contenu tenant ; nom de serveur partagé `disciplina-crm` |
| `front/.../src/store/regionStore.ts:3-27` | Store de région persisté |
| `front/.../src/pages/LoginPage.tsx:12-15` | Sélecteur de région au login, les deux déclarées |
| `front/.../src/components/layout/RegionBadge.tsx:4-18` | Badge par région |
| `back/src/external/sirene/*`, `back/src/external/geocodage/*` | API nationales, aucune hypothèse DOM |
| `front/.../src/data/nafCodes.ts` | Fichier mort, aucune géographie — candidat suppression |
| `database/mongodb/mongo-init.js` | Aucun littéral géographique, seulement des index |
| `back/src/services/ImmersionEndNotificationService.ts` | Entièrement dynamique |
| `back/src/utils/matchingLink.ts` | Chemins relatifs uniquement |
| `scripts/delete_companies.py:383` | `--tenant` avec `choices=("reunion","annemasse")` |
| `back/src/db/mysql/connection.ts` (usage) | Le code de prod n'utilise que `query` / `getConnection` / `getPool`, qui routent par `getRegion()`. Le default export figé est un piège **de test** uniquement → `DEBT-02` |

---

## 3. Matrice de sévérité

| Lot | BLOQUANT | COSMÉTIQUE | DETTE | Total |
|---|---|---|---|---|
| **Lot 1** — `TZ-*` fuseaux horaires | 7 | 1 | 0 | 8 |
| **Lot 2** — `ID-*` identité & documents | 18 | 3 | 0 | 21 |
| **Lot 3** — `GEO-*` référentiel géographique | 16 | 7 | 0 | 23 |
| **Lot 3** — `SEED-*` données & imports | 5 | 0 | 1 | 6 |
| **Lot 4** — `DEBT-*` dette transversale | 0 | 2 | 8 | 10 |
| **Total** | **46** | **13** | **9** | **68** |

**Chemin critique** : `GEO-01` → `GEO-02` → `GEO-03` → `GEO-04` conditionnent tout le reste. Changer uniquement les libellés (`COS-*`) ne débloque **rien** fonctionnellement. Changer les énumérations sans corriger le filtre de matching (`GEO-06`, `GEO-07`) donne des listes de match vides.

**Deux lots autonomes** ne dépendent d'aucun autre : le cluster fuseaux (`TZ-*`) et les pages légales / PDF (`ID-*`).

---

## 4. Inventaire des constats

### 4.1 `TZ-*` — Fuseaux horaires (Lot 1)

`Indian/Reunion` = UTC+4 sans DST. `Europe/Paris` = UTC+1/+2. Écart de 2 h en hiver, 3 h en été.

| ID | Sév. | Emplacement | Valeur en dur | Impact Annemasse |
|---|---|---|---|---|
| `TZ-01` | **BLOQUANT** | `database/mysql/mysql-init.sql:74` + `back/src/db/mysql/migrations.ts:205` | `booking_settings.timezone DEFAULT 'Indian/Reunion'` | `getOrCreate()` (`back/src/rest/booking/service.ts:130`) crée chaque page de réservation Annemasse en UTC+4. Le décalage se propage ensuite à 6 sites de rendu : `:215` (créneaux), `:257,267,268,289,297` (mail de confirmation, token `{{date}}`). |
| `TZ-02` | **BLOQUANT** | `back/src/services/ExternalInterviewService.ts:47-51` | `timeZone: 'Indian/Reunion'` dans `formatFr()` | L'heure de rendez-vous proposée à un **candidat externe** est fausse. |
| `TZ-03` | **BLOQUANT** | `front/.../src/pages/rh/Matching.tsx:1341,1374-1375,1554` | `timeZone: 'Indian/Reunion'` | Horodatage de la fiche de matching faux pour le RH Annemasse. `regionStore` est pourtant importé dans l'app. |
| `TZ-04` | **BLOQUANT** | `front/.../src/pages/external/ExternalInterview.tsx:27` | `timeZone: 'Indian/Reunion'` | Idem, vue candidat externe. |
| `TZ-05` | **BLOQUANT** | `front/.../src/features/publicMatch/components/InterviewProposalForm.tsx:16,84` | `timeZone: 'Indian/Reunion'` | Créneaux proposés faux sur le formulaire de proposition. |
| `TZ-06` | **BLOQUANT** | `back/src/external/yousign/yousign.service.ts:47` | `timezone: 'Europe/Paris'` | **Défaut inverse** : faux pour la Réunion (2-3 h) sur l'enveloppe DocuSeal/YouSign. Preuve que le fuseau n'a jamais été centralisé. |
| `TZ-07` | **BLOQUANT** | `back/src/rest/calendar/notifications.ts:12-13,84` | `DEFAULT_TZ = 'Indian/Reunion'` | Défaut de plateforme. Masqué en pratique par `settings.timezone` passé à l'unique site d'appel (`back/src/rest/calendar/controller.ts:264`) — mais reste le défaut si l'appelant omet l'argument. Le commentaire du fichier documente l'hypothèse Réunion. |
| `TZ-08` | COSMÉTIQUE | `front/.../src/pages/rh/MailTemplates.tsx:33` | exemple `{ date: '... (Indian/Reunion)' }` | Exemple figé dans l'éditeur de templates, apprend la mauvaise zone au RH. Contraste : `front/.../src/pages/booking/PublicBooking.tsx:83` lit correctement `info.timezone` depuis l'API. |

> **Correction d'audit sur `TZ-02`.** La première version de ce tableau affirmait « `region` est
> disponible sur la ligne `external_access` et n'est pas utilisé ». C'est faux :
> `external_access` n'a **aucune colonne `region`** (cf. `database/mysql/mysql-init.sql`).
> La région d'un flux guest est déjà résolue par le middleware
> `resolveExternalRegion` (`back/src/rest/external/region.ts`), qui la pose dans l'ALS à
> partir du suffixe de la signature (`<sig>:<region>`). Le correctif de `TZ-02` n'a donc rien
> ajouté : il consomme la région que ce middleware expose déjà.

#### 4.1.a Résolution

| ID | Statut | Correctif |
|---|---|---|
| `TZ-01` | **CORRIGÉ** | `runMysqlMigrations(dbQuery, timezone)` applique et backfill le fuseau du tenant ; appelé une fois par région dans `back/src/index.ts`. `mysql-init.sql` fixe explicitement `DEFAULT 'Europe/Paris'` sur la table clonée Annemasse. Validé sur volume frais **et** volume existant. |
| `TZ-02` | **CORRIGÉ** | `formatFr()` s'appuie sur `tenantTimezone()` (ALS). |
| `TZ-03` | **CORRIGÉ** | `Matching.tsx` lit `regionStore` et passe le fuseau résolu ; les 4 `timeZone: 'Indian/Reunion'` et l'offset `+04:00` ont disparu. |
| `TZ-04` | **CORRIGÉ** | `ExternalInterview.tsx` lit `timezone` sur le profil. |
| `TZ-05` | **CORRIGÉ** | `InterviewProposalForm` reçoit `timezone` en prop et convertit via `zonedWallClockToIso()`. |
| `TZ-06` | **HORS PÉRIMÈTRE** | Non traité. Le défaut inverse est réel mais sort du lot fuseaux : le corriger engage la chaîne de signature YouSign/DocuSeal et son stockage, à traiter dans un lot dédié. Décision actée par le commandeur du lot. |
| `TZ-07` | **CORRIGÉ** | `DEFAULT_TZ` devient une fonction `defaultTz()` évaluée **à chaque appel** — jamais une constante au chargement du module, l'ALS étant vide à l'import. |
| `TZ-08` | **CORRIGÉ** | L'exemple `{{date}}` est calculé sur le fuseau du tenant connecté. |

##### Source de vérité

- Backend : `TENANT_TIMEZONE` (`back/src/config/tenant.ts`) + `tenantTimezone()` (`back/src/db/tenant.ts`).
- Frontend : `REGION_TIMEZONE` / `regionTimezone()` / `zonedWallClockToIso()` / `isoToZonedWallClock()`
  dans `front/disciplina-front/src/lib/timezone.ts` — **seul** fichier autorisé à contenir un
  fuseau IANA ou un décalage UTC en dur.
- Pages staff : `regionTimezone(useRegionStore((s) => s.region))`.
- Pages guest : champ `timezone` de `GET /:signature/profile` (nouveau), qui lit l'ALS du tenant.

##### Garde anti-régression

`front/disciplina-front/eslint.config.js` porte un bloc `no-restricted-syntax` qui interdit,
hors `src/lib/timezone.ts` : tout littéral contenant `Indian/Reunion` ou `Europe/Paris`, tout
`TemplateElement` contenant un décalage UTC (`NN+0X:XX`), et tout littéral `+0X:XX`.
Vérifié négativement : la règle attrape les 10 occurrences du code d'origine
(`Matching.tsx` ×5, `InterviewProposalForm.tsx` ×3, `ExternalInterview.tsx` ×1,
`MailTemplates.tsx` ×1) et ne produit aucun faux positif sur les 239 fichiers actuels.

> Note : le sélecteur du fuseau est une **sous-chaîne** et non une égalité. L'exemple TZ-08
> était `'lundi 22 juin 2026 à 14:30 (Indian/Reunion)'` — un littéral exact `'Indian/Reunion'`
> ne l'aurait pas attrapé.


---

### 4.2 `ID-*` — Identité légale, documents, URLs (Lot 2)

#### 4.2.a Documents PDF

| ID | Sév. | Emplacement | Valeur en dur | Impact Annemasse |
|---|---|---|---|---|
| `ID-01` | **BLOQUANT** | `back/src/services/PdfService.ts:186-188` | `71 rue Roger Payet, Sainte-Marie 97438` · SIRET `97828986600011` · NDA `04973484197` · *« Préfet de région de Réunion »* · date de révision `25/02/2026` figée | Chaque PDF de convention / attestation Annemasse porte l'identité légale Réunion. |
| `ID-02` | **BLOQUANT** | `back/src/services/PdfService.ts:508-546` | 3 sites (Sainte-Marie / Saint-Paul / Saint-Pierre) + **20 salariés nommés** avec emails `*.commercial@` / `*.rh@` / `*.administration@` / `*.pedagogie@` / `*.of@disciplina.re` et portables `0693…` | Page « Contacts » des PDF de besoin d'analyse : Annemasse reçoit les coordonnées du personnel réunionnais. |
| `ID-03` | **BLOQUANT** | `back/src/services/PdfService.ts:614-616` | `NORD_SAINTE_MARIE: 'Nord — Sainte-Marie'`, etc. | Les valeurs Annemasse tombent sur la clé d'énum brute. |
| `ID-04` | **BLOQUANT** | `back/src/services/PdfService.ts:636-657` | map `SAINT_DENIS: 'Saint-Denis'` … 26 communes | `formatCommune()` dégrade proprement pour l'affichage, mais toute valeur Annemasse s'affiche en `ANNEMASSE` brut. |
| `ID-05` | **BLOQUANT** | `back/assets/Mandat pour la publication d'une offre d'emploi (1).pdf` | `EURL DISCIPLINA`, SIRET `978 289 866 00011`, NDA `04 97 34841 97`, UAI `9741905C`, `71 rue Roger Payet … 97438` | Pièce jointe des enveloppes de signature, non substituable. **Contradiction interne** : le PDF dit `EURL`, la page légale `ID-09` dit `SARL`. |
| `ID-06` | **BLOQUANT** | `back/assets/Catalogue Disciplina.pdf` | `contact@disciplina.re`, `0693 88 80 21`, 3 adresses de sites Réunion | Attaché aux enveloppes depuis `NeedsAnalysisService:349`. |
| `ID-07` | COSMÉTIQUE | `back/src/services/PdfService.ts:175` | marque `Disciplina` en bleu `#1130A7` | Couleur Réunion ; Annemasse est en violet `#60207E` (`RegionBadge.tsx:6`). Pas de mécanisme de variante. |

#### 4.2.b Pages légales publiques

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `ID-08` | **BLOQUANT** | `front/.../src/content/legal/mentions-legales.md` | Identité Réunion complète : `:14` `Disciplina Réunion` · `:15` `SARL` · `:16` capital · `:17` siège `97438 Sainte-Marie` · `:18` SIRET · `:19` RCS `978 289 866 RCS Saint-Denis` · `:20` TVA `FR71 978 289 866` · `:21-22` tel + email · `:24` directeur de publication · `:28-34` NDA + Qualiopi · `:40-41` hébergeur Réunion · `:50` URL `app-reunion.disciplina.re` · `:99-100,113,120-127` médiateur / signalement |
| `ID-09` | **BLOQUANT** | `front/.../src/router/index.tsx:247-269` | Routes `/legal/*` **publiques, sans authentification et sans garde de région** (zéro `useRegionStore` dans `pages/legal/`). Un candidat Annemasse qui suit un lien CGU est informé que le responsable de traitement est « Disciplina Réunion », SIRET Réunion, `97438`. **Exposition LCEN / RGPD.** |
| `ID-10` | **BLOQUANT** | `front/.../src/content/legal/politique-confidentialite.md:3,5,12,20-25` · `politique-cookies.md:3,6` · `cgu/annexe-candidat.md:3,6,63,95,109,136,137` · `cgu/annexe-entreprise.md:3,6,148` · `cgu/annexe-interne.md:3,6` · `cgu/socle.md:3,10,20,23,40,44,129,212,309,329,330,331,333` | ~40 `[[PLACEHOLDER]]` **visibles en production**. `docs/legal_mention_to_complete.md:43` pose la règle : « Aucun document ne doit être publié tant qu'un placeholder reste. » |
| `ID-11` | **BLOQUANT** | `front/.../src/content/legal/_placeholders.md:24,26,53,54` | Registre des placeholders lui-même parsemé d'exemples Réunion (`Saint-Denis 123 456 789`, `97400 Saint-Denis`, `https://app-reunion.disciplina.re`) — à purger en même temps que la substitution est introduce. |

#### 4.2.c URLs, domaines, runtime

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `ID-12` | **BLOQUANT** | `back/src/config/env.ts:98-99` | `APP_BASE_URL` / `FRONTEND_BASE_URL` process-global. 9 consommateurs obliged d'émettre le même lien pour les deux tenants : `back/src/mcp/oauth/consentPage.ts:73` (reset mot de passe) · `back/src/rest/calendar/controller.ts:304` (`bookingUrl`) · `back/src/rest/relance/controller.ts:205-206` · `back/src/services/ExternalAccessService.ts:72,115` · `back/src/services/InterviewMailService.ts:37` · `back/src/services/NeedsAnalysisService.ts:586,596` · `back/src/services/OfferService.ts:934`. Ni l'un ni l'autre n'est documenté dans `back/.env.back.example`. |
| `ID-13` | **BLOQUANT** | `front/disciplina-front/vite.config.ts:35` | `allowedHosts: ['app-reunion.disciplina.re']` → **le host Annemasse est rejeté par le serveur de dev Vite**. |
| `ID-14` | **BLOQUANT** | `back/src/index.ts:84` | CSP MCP `connect-src` : `'https://app-reunion.disciplina.re/'` en dur. |
| `ID-15` | **BLOQUANT** | `front/.../src/main.tsx:33` | `tracePropagationTargets: ['localhost', /^https:\/\/app-reunion\.disciplina\.re\/api/]` → aucune propagation de trace distribuée pour les appels API Annemasse. Observabilité, pas visible utilisateur. |
| `ID-16` | COSMÉTIQUE | `HOWTODEPLOY.md:140-141,154,157,172-173` | Doc de déploiement épinglée sur le host Réunion (MCP issuer, connecteur, bloc Caddy `appreunion`, curls `.well-known`). |

#### 4.2.d Emails et identité émetteur

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `ID-17` | **BLOQUANT** | `back/src/external/google/system-mail.ts:9` · `back/src/external/google/no-reply.ts:3-9` | `dev@disciplina.re` / `noreply@disciplina.re` en dur, pas de `Reply-To` par tenant, footer marque partagée. |
| `ID-18` | **BLOQUANT** | `back/src/services/abRelanceTemplate.ts:12` · `abSignatureTemplate.ts` · `commercialSignatureTemplate.ts` | Subjects fallback contenant `DISCIPLINA`, utilisés quand aucun template DB n'existe (`AbSignatureRelanceService.ts:97-98`, `MailTemplateService.findCommercialTemplateByKind`). |
| `ID-19` | **BLOQUANT** | `back/src/services/NeedsAnalysisService.ts:596` | Signature `L'équipe Disciplina` en dur. |
| `ID-20` | **BLOQUANT** | `back/src/db/mysql/migrations.ts:70-78,472-473` | 9 emails RH Réunion (`grondin.rh@`, `boyer.rh@`, `gouard.rh@`, `solati.rh@`, `armouet.rh@`, `galais.rh@`, `nativel.rh@`, `payet.rh@`, `direction@disciplina.re`) passés `is_interviewer = 1` → le picker « RH intervieweur » de l'AB affiche du personnel réunionnais sur Annemasse. |
| `ID-21` | COSMÉTIQUE | `front/.../src/pages/rh/MailTemplates.tsx:42,45` | Exemples d'URLs dans l'éditeur de templates. |

---

### 4.3 `GEO-*` — Référentiel géographique (Lot 3)

#### 4.3.a Schéma & énumérations

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `GEO-01` | **BLOQUANT** | `back/src/types/matching.types.ts:47-72` · validé par `back/src/db/mongo/schemas/candidate.schema.ts:194` (`job_info.geographic_mobility`) et `back/src/db/mongo/schemas/position.schema.ts:18` (`localisation`) | `Localisation` = **26 communes Réunion** (974xx). Aucune valeur hors enum n'est acceptée : Mongo rejette, pas de repli silencieux. → `job_info.geographic_mobility` et `localisation` ne peuvent contenir `ANNEMASSE`, `THONON_LES_BAINS`, `GENEVA`. Dupliqué 2× côté front : `front/.../src/types/candidate.ts:53-80` et `front/.../src/features/matching/constants/jobEnums.ts:47-73`. Exposé dans `back/src/graphql/candidate/typeDefs.ts:12-38`. |
| `GEO-02` | **BLOQUANT** | `back/src/types/candidate.types.ts:34-38` | `TrainingSite` = 3 sites Réunion. Seul intrant de `candidateZones()` (`back/src/utils/zone.ts:56-68`) ⇒ la « zone » de tout candidat Annemasse est une zone réunionnaise. |
| `GEO-03` | **BLOQUANT** | `back/src/types/needsAnalysisNoSql.types.ts:4-8` · `back/src/db/mongo/schemas/needsAnalysis.schema.ts:26` · `back/src/db/mongo/schemas/offer.schema.ts:12` | `CompanyRegion` = `NORD\|OUEST\|SUD`, validé à l'écriture. Un AB Annemasse doit déclarer `sector = 'NORD'`, valeur ensuite développée en communes Réunion par le matching. |
| `GEO-04` | **BLOQUANT** | `back/src/types/kpi.types.ts:1-3` · `back/src/rest/kpi/controller.ts:15-16` · `back/src/services/KpiService.ts:191-196` | `KpiSite` = 3 valeurs. Le contrôleur REST retombe sur `'NORD'` pour toute valeur inconnue. → Le dashboard KPI Annemasse affiche 3 onglets Nord-Est/Ouest/Sud, sans axe Annemasse, toutes les données dans `NORD`. |

#### 4.3.b Matching — le blocage le plus lourd

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `GEO-05` | **BLOQUANT** | `back/src/services/mappers/abToOffer.ts:5-46` | `ZONE_TO_COMMUNES` = référentiel fermé de 26 communes Réunion, sans dimension tenant. Inverti en `COMMUNE_TO_ZONE` (`back/src/utils/zone.ts:18-23`), consommé par `zonesFromCommunes()`, `candidateZones()`, `communesForZones()`. Le commentaire d'en-tête du module dit qu'il « doit couvrir tout l'enum `Localisation` » — c'est un ensemble fermé. |
| `GEO-06` | **BLOQUANT** | `back/src/services/OfferService.ts:285-303` | **Le filtre géographique développe la zone en communes Réunion** : `ZONE_TO_TRAINING_SITE[z]` puis `communesForZones(offerZoneSet)`. Une offre Annemasse (`sector = NORD`) produit `mobility ∈ [10 communes nord réunionnaises] OR training_site ∈ [NORD_SAINTE_MARIE]`. → **Un candidat Annemasse réel n'est jamais proposé.** |
| `GEO-07` | **BLOQUANT** | `back/src/services/CandidateService.ts:361-373` | Même filtre dans l'autre sens (`MatchedJobsList` de la fiche candidat). **Asymétrie** : la direction *push* (`GEO-06`) ajoute `communesForZones`, la direction *pull* non. Incohérence préexistante, indépendante de la géographie. |
| `GEO-08` | **BLOQUANT** | `back/src/utils/zone.ts:45-53` | `offerZones()` **jette silencieusement** tout `company_infos.sector` hors des 3 clés — ni erreur, ni log. Un AB `HAUTE_SAVOIE` produirait un ensemble de zones vide, qui retombe ensuite sur un filtre plus faible. |

#### 4.3.c Secteurs — propagation

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `GEO-09` | **BLOQUANT** | `back/src/utils/sector.ts:10-18,41-45` | `SECTORS = ['Nord-Est','Ouest','Sud']` global, `SECTOR_TO_REGION` / `REGION_TO_SECTOR` en dur. `sanitizeSectors()` (`:25-28`) **filtre silencieusement** toute valeur inconnue. |
| `GEO-10` | **BLOQUANT** | `back/src/graphql/company/resolvers.ts:58-59` | `ALLOWED_SECTORS = new Set(['Nord-Est','Ouest','Sud'])`, `DEFAULT_SECTOR = 'Nord-Est'`. → Un commercial Annemasse ne peut pas tagger une entreprise « Haute-Savoie » ; tout est `Nord-Est`, qui pilote ensuite le KPI, le dossier Drive et la visibilité agenda. |
| `GEO-11` | **BLOQUANT** | `database/mysql/mysql-init.sql:507-514` + `back/src/db/mysql/migrations.ts:385-389,459-461` | Les 3 lignes `sector_settings` Réunion sont **copiées** dans `disciplina_annemasse` (`INSERT IGNORE ... SELECT ... FROM disciplina.sector_settings`) **et ré-appliquées à chaque boot** par `SECTOR_SETTINGS_DEFAULTS` via `INSERT IGNORE`. L'écran *Sector Settings* Annemasse (éditable, `back/src/rest/sectorSettings/controller.ts:8-30`, MCP `back/src/mcp/tools/misc.ts:20-26`) affiche « Sainte-Marie / Saint-Paul / Saint-Pierre », et les 3 **clés** ne sont ni renommables ni extensibles. |
| `GEO-12` | **BLOQUANT** | `back/src/rest/calendar/controller.ts:135-138` + `back/src/utils/sector.ts:53-56` | Visibilité agenda : un `EMPLOYEE` ne voit que les agendas de son secteur. Fonctionne **par accident** car tous les utilisateurs Annemasse sont `Nord-Est` (le filtre dégénère en « tout le monde »). Dès qu'Annemasse a un 2ᵉ secteur, des collègues disparaissent. Même mécanisme pour le lieu de réunion par défaut (`front/.../src/pages/rh/Calendrier.tsx:847-849`, fallback `DEFAULT_SECTEUR`). |
| `GEO-13` | **BLOQUANT** | `back/src/services/AbDriveConfigService.ts:86-87` + `back/src/graphql/needsAnalysis/resolvers.ts:44-47` + `back/src/services/DriveFolderConfigService.ts:8-17,24-31` | `sectorFromRegion(region) ?? 'Nord-Est'` → **le PDF signé de chaque AB Annemasse est écrit dans le dossier Drive « Nord-Est »**. Le mapping est aussi re-implémenté dans `back/src/services/NeedsAnalysisService.ts:48-50` (`REGION_TO_USER_SECTOR`), 3ᵉ copie. |
| `GEO-14` | **BLOQUANT** | `back/src/services/NeedsAnalysisService.ts:56-62,570-571` | Filtrage des destinataires RH par `userBelongsToSector()` — tous les RH Annemasse étant `Nord-Est`, tout le monde est notifié. Fonctionnel mais dégradé dès qu'un 2ᵉ secteur existe (idem `GEO-12`). |
| `GEO-15` | **BLOQUANT** | `front/.../src/constants/secteurs.ts:12-42` | Le refactor front est propre (source unique, `SECTEUR_VALUES` déclarée une fois et ré-exportée par `front/.../src/types/entreprise.ts:8-11`) **mais le vocabulaire centralisé reste `Nord-Est/Ouest/Sud`**, avec `DEFAULT_SECTEUR = 'Nord-Est'`. 12 écrans consommateurs : |
| | | | `components/admin/UserEditModal.tsx:7,202` · `pages/RegisterPage.tsx:9,165` · `features/portefeuille/components/CreateEditModal.tsx:5,50-53,363` · `pages/commercial/EntreprisePage.tsx:27,405-416` · `pages/commercial/PortefeuilleEntreprises.tsx:27,102,148` · `pages/commercial/AbDriveConfig.tsx:6,9` · `pages/rh/DriveConfig.tsx:6,10-11` · `pages/rh/Calendrier.tsx:17-18,849,1105` · `pages/rh/DashboardRH.tsx:37,72,603-612,857` · `features/kpi/components/RhKpiPanel.tsx:12,46,124` · `features/kpi/config.ts:3,6` · `pages/profile/ProfilePage.tsx:11,28` |
| | | | ⚠ `CreateEditModal.tsx:50-53` : une valeur stockée non reconnue devient silencieusement `DEFAULT_SECTEUR` au lieu de remonter une erreur. |
| `GEO-16` | **BLOQUANT** | `front/.../src/data/reunionCommunes.ts:1-6,71-74` + 12 consommateurs | 37 codes postaux 974xx, 26 communes. `cityFromPostalCode()` : saisie `74100` → **pas d'autocomplétion de la ville**. `LOCALISATION_LABELS` : la mobilité géographique ne propose que les 26 communes Réunion → **un RH Annemasse ne peut littéralement pas saisir qu'un candidat se déplacera à Annemasse**. `formatCommune()` dégrade proprement (usage affichage seul). |
| | | | Consommateurs : `cityFromPostalCode` → `components/rh/CandidateFormModal.tsx:13,1112-1114`, `pages/rh/QuestionnaireAB.tsx:7,486` · `LOCALISATION_LABELS` → `CandidateFormModal.tsx:13,1280`, `pages/rh/ListeCandidats.tsx:13,522`, `pages/rh/QuestionnaireAB.tsx:7,730`, `pages/rh/Matching.tsx:55,182,1254`, `features/candidates/components/JobSearchModal.tsx:5,178`, `features/candidats/components/MatchedJobsList.tsx:5,181`, `features/matching/components/JobFilters.tsx:8,187` · `formatCommune` → `features/abEntreprise/components/ABDetailModal.tsx:7,222`, `NeedsAnalysisModal.tsx:16,1241`, `features/matching/components/CompanyInfoModal.tsx:7,180`, `NeedsAnalysisCard.tsx:7,37`, `pages/rh/FicheCandidat.tsx:22,1055`, `pages/rh/ListeCandidats.tsx:13,747` |

#### 4.3.d `COS-*` — Cosmétique géographique

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `COS-01` | COSMÉTIQUE | `front/.../src/pages/rh/DashboardRH.tsx:75-77` + `pages/rh/FicheCandidat.tsx:67-69` | Libellés `Nord-Est · Sainte-Marie` / `Ouest · Saint-Paul` / `Sud · Saint-Pierre` pour les candidats Annemasse. |
| `COS-02` | COSMÉTIQUE | `front/.../src/data/candidateTemplates.ts:213-215` | Adresses de hubs Réunion (`HUB Lizine, Sainte-Marie`, `Lizine Savanna, Saint-Paul`, `Lizine Grand Bois, Saint-Pierre`) dans les templates mail candidat et la fiche candidat. |
| `COS-03` | COSMÉTIQUE | `front/.../src/components/layout/Sidebar.tsx:89` | `loic@disciplina.fr` en dur dans la sidebar. |
| `COS-04` | COSMÉTIQUE | `front/.../src/data/mockCandidates.ts:19,44,69,…` | 20 portables Réunion `0692…`/`0693…`. Fichier **mort** (exporté `:9`, jamais importé) — à supprimer, pas à migrer. |
| `COS-05` | COSMÉTIQUE | `back/src/assets/logo-disciplina.svg` + `front/disciplina-front/public/logo-disciplina.svg` + `back/src/mcp/oauth/consentLogo.ts:1-8` | Wordmark unique partagé. Acceptable (`docs/legal_mention_to_complete.md:60` : « Disciplina (2 sites) ») mais aucun mécanisme de variante. |
| `COS-06` | COSMÉTIQUE | `docs/gen_champs_docx.py:135,159` | Adresses Réunion dans le corpus Word généré. |
| `COS-07` | COSMÉTIQUE | `back/src/services/mappers/candidate.mapper.ts:135` | `departmentOfBirth: … ?? '97400'` → un candidat né en Haute-Savoie sans département saisi est exporté **97400 La Réunion** dans l'Excel/PDF. Corruption de données, visible uniquement à l'export. Le formulaire, lui, propose une autocomplétion nationale (`CandidateFormModal.tsx:1104` → `/api/sourcing/departement`). |

---

### 4.4 `SEED-*` — Données de test & imports (Lot 3)

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `SEED-01` | **BLOQUANT** | `scripts/seed_annemasse_test_data.py:246,321-396,491,600,525-690` | Le jeu de données Annemasse utilise `training_site = "NORD_SAINTE_MARIE"`, `localisation = ["SAINT_DENIS"]` (candidats et offres), `region = "NORD"` (entreprises) — alors que les **adresses** du même fichier sont correctes (`74100 Annemasse`, `74240 Gaillard`, `74380 Cranves-Sales`, `74500 Évian-les-Bains` à `:112-184`). **Le jeu est cohérent en termes réunionnais, donc le matching retourne des lignes et tous les tests passent au vert, sans couvrir aucun chemin Annemasse réel.** Il ne peut pas détecter `GEO-06`/`GEO-07`. La couche adresses a été migrée, pas la couche matching. |
| `SEED-02` | **BLOQUANT** | `scripts/lib/company_csv.py:13-35,111-115,189` | `POSTAL_TO_ZONE` = 36 codes 974xx ; `postal_to_zone()` fait `re.search(r"\b(974\d{2})\b", …)` et **retourne `DEFAULT_ZONE = "Nord-Est"` sans avertissement** si le motif ne matche pas. Un import CSV Annemasse « réussit » et classe chaque entreprise en `Nord-Est`. |
| `SEED-03` | **BLOQUANT** | `scripts/lib/candidate_csv.py:23-50,465` | `TRAINING_SITES` = 3 sites Réunion, `LOCALISATION` = 26 valeurs, `COMMUNE_POSTAL` = 974xx, `postal_code` par défaut `"974"`. Un CSV candidat Annemasse ne peut exprimer ni site de formation ni commune de mobilité. |
| `SEED-04` | **BLOQUANT** | `scripts/lib/recruitment_csv.py:140-186` | 4ᵉ copie indépendante de la map 26 communes → 3 zones, plus une configuration fichier figée sur NORD/OUEST/SUD plus bas. |
| `SEED-05` | **BLOQUANT** | `scripts/lib/digiforma_sync.py:385,415` | `"Nord-Est"` en fallback. Si la synchronisation Digiforma est pointée sur Annemasse, chaque entreprise synchronisée est classée `Nord-Est`. |
| `SEED-06` | DETTE | `scripts/lib/blacklist_csv.py:14-24` | Ne reconnaît que `nord` et `ouest` (pas `sud`). Confirmations que le vocabulaire est réinventé à chaque script. |

---

### 4.5 `DEBT-*` — Dette transversale (Lot 4)

| ID | Sév. | Emplacement | Constat |
|---|---|---|---|
| `DEBT-01` | DETTE | `back/src/db/mysql/migrations.ts:60,372` | `mcp_oauth_refresh_tokens.region VARCHAR(16) NOT NULL DEFAULT 'reunion'`. Un insert omettant la colonne écrit `'reunion'` dans la base Annemasse. **Latent** : `back/src/index.ts:184-187` fait tourner les migrations sur le pool Annemasse et les deux chemins d'insert positionnent la colonne explicitement. |
| `DEBT-02` | DETTE | `back/src/db/mysql/connection.ts:110` | `export default pools.reunion` — le **seul default export autorisé** par `CLAUDE.md` est figé sur le pool Réunion. Le code de production n'utilise que `query` / `getConnection` / `getPool` (qui routent par `getRegion()`), donc aucun impact en prod, mais **tous les fichiers de test** font `import pool from …` et écrivent donc dans la base Réunion sans le dire. Piège latent pour tout futur test Annemasse. |
| `DEBT-03` | DETTE | 4 à 6 copies du vocabulaire | Voir tableau §5. |
| `DEBT-04` | DETTE | `back/src/types/tenant.ts:1` vs `Region` dans `mcp_oauth_refresh_tokens` | Le schéma SQL utilise `VARCHAR(16)` libre là où le TS impose une union. Aucune contrainte DB. |
| `DEBT-05` | DETTE | `database/mysql/mysql-init.sql:74,101,158,297` | Les valeurs par défaut MySQL (`'Indian/Reunion'`, `'Nord-Est'`, `'reunion'`) sont **copiées telles quelles** dans `disciplina_annemasse` par `CREATE TABLE … LIKE` (`:403-474`). Toute valeur par défautgeo-scopée doit être gérée côté application, pas côté DDL. |
| `DEBT-06` | DETTE | `RGPD.md:588,709-711,988,1023` · `HOWTODEPLOY.md:140-173` | Docs internes épinglées sur l'hôte Réunion. `RGPD.md` contient aussi des secrets weak en exemple (déjà suivi par `BACKLOG.md` `RGPD-6`/`F11`). |
| `DEBT-07` | DETTE | `back/src/types/matching.types.ts` | `SAINT_PHILLIPE` (un seul `L`) — typo qui existe aussi dans l'enum, donc auto-cohérente mais non standard. |
| `DEBT-08` | COSMÉTIQUE | `mentions-legales.md:15` vs `back/assets/Mandat…pdf` | **`SARL` vs `EURL`** — l'identité juridique de l'émetteur est contradictoire **au sein même du tenant Réunion**. |
| `DEBT-09` | COSMÉTIQUE | `mentions-legales.md:17` vs `docs/legal_mention_to_complete.md:66` · `PdfService.ts:187` vs `mentions-legales.md:28` | Siège `Sainte-Marie` vs `Saint-Denis` ; NDA `04973484197` vs `04 97 34841 97`. |
| `DEBT-10` | DETTE | `BACKLOG.md:178` (`FE-3`) | Énoncé « `SECTEUR_VALUES` redéclaré dans 5 écrans » — **périmé**, le refactor `front/.../src/constants/secteurs.ts:14` a centralisé. À clôturer. |

---

## 5. Copies multiples du vocabulaire géographique

| # | Vocabulaire | Valeurs | Emplacement | Statut |
|---|---|---|---|---|
| 1 | Secteur métier (backend) | `Nord-Est\|Ouest\|Sud` | `back/src/utils/sector.ts:10` | canonique |
| 2 | Région brute (Drive/AB/KPI) | `NORD\|OUEST\|SUD` | `back/src/utils/sector.ts:14-18,41-45` + `back/src/types/kpi.types.ts:1` + `back/src/types/needsAnalysisNoSql.types.ts:4` | redondant |
| 3 | Communes (backend) | 26 | `back/src/services/mappers/abToOffer.ts:5-46` | redondant |
| 4 | `Localisation` (Mongo validator) | 26 | `back/src/db/mongo/schemas/candidate.schema.ts:194`, `position.schema.ts:18` | redondant |
| 5 | `Localisation` (front) × 2 | 26 | `front/.../src/types/candidate.ts:53-80`, `features/matching/constants/jobEnums.ts:47-73` | redondant |
| 6 | Communes + CP (front) | 37 CP | `front/.../src/data/reunionCommunes.ts:6-68` | redondant |
| 7 | `REGION_COMMUNES` (front matching) | Réunion | `front/.../src/features/matching/constants/regions.ts:7-40` | redondant |
| 8 | Secteurs (front) | `Nord-Est\|Ouest\|Sud` | `front/.../src/constants/secteurs.ts:12-21` | canonique front |
| 9 | Mapping TrainingSite→secteur | 3 | `front/.../src/constants/secteurs.ts:38-42` + `front/.../src/pages/rh/Relance.tsx:22-31` (`ZoneKey` + `AUTRE`) + `DashboardRH.tsx:75-77` | redondant |
| 10 | `REGION_TO_USER_SECTOR` | 3 | `back/src/services/NeedsAnalysisService.ts:48-50` | redondant |
| 11 | `sector_settings` (MySQL) | 3 | `database/mysql/mysql-init.sql:507-514` + `migrations.ts:385-389` | redondant |
| 12-15 | Copies Python | — | `scripts/lib/company_csv.py:13-35` · `candidate_csv.py:23-50` · `recruitment_csv.py:140-186` · `blacklist_csv.py:14-24` | redondant |

**Ajouter une commune demande aujourd'hui 4 éditions coordonnées dans 2 repos, sans lien de compilation.** Déjà suivi par `BACKLOG.md:154` (`DB-12`) et `BACKLOG.md:168` (`API-6`).

---

## 6. Pièges à traiter en premier

1. **`SEED-01` — le seed vert qui ne teste rien.** Tant que le jeu Annemasse simule la Réunion, toute correction de `GEO-*` semblera ne rien changer. Corriger le seed **avant** d'évaluer l'avancement du Lot 3.
2. **`GEO-12` / `GEO-14` — correction qui fonctionne par accident.** `shareSector()` ne renvoie le bon résultat que parce que le tenant Annemasse n'a qu'un secteur. Ajouter un 2ᵉ secteur Annemasse fera **disparaître** des collègues de l'agenda. Ne pas traiter `GEO-12` isolément.
3. **`GEO-06` / `GEO-07` — asymétrie push/pull.** `OfferService` ajoute `communesForZones()`, `CandidateService` non. Le pull est plus strict que le push : une offre peut apparaître côté RH et ne jamais apparaître côté candidat. Préexistant, mais à corriger dans le même changement.
4. **`GEO-08` / `GEO-15` — rejets silencieux.** `offerZones()` jette la valeur hors enum sans log ; `CreateEditModal.tsx:50-53` transforme une valeur inconnue en `Nord-Est`. Toute migration de référentiel doit **rendre ces rejets visibles** (erreur ou log), sinon les données mal classées resteront invisibles.
5. **`ID-10` — publication légale non conforme.** ~40 `[[PLACEHOLDER]]` visibles en production **sur les deux tenants**, indépendamment de la géographie. Réglementaire, prioritaire sur l'esthétique du backlog.
6. **`DEBT-08` — contradiction EURL/SARL.** À trancher avant de modéliser le profil tenant : l'identité à saisir pour Annemasse dépend de la forme juridique retenue.

---

## 7. Découpage en lots

Format de `BACKLOG.md` : XS < 1 h · S ≈ ½ j · M ≈ 1-3 j · L > 3 j.

### Lot 1 — Fuseaux horaires (`TZ-*`) · XS+S — **TERMINÉ (`TZ-06` hors périmètre)**

**Périmètre** : introduire une source unique de fuseau par tenant (sur le modèle de `back/src/scheduler/pedaDraftScheduler.ts:12-15`), l'exposer au frontend, puis substituer les 8 occurrences.

- [x] `TZ-07` source unique backend + injection dans le contexte tenant
- [x] `TZ-01` `TZ-02` substitution backend (dont le défaut MySQL via `migrations.ts`)
- [ ] `TZ-06` correction du défaut inverse YouSign — **sorti du lot**, à réintégrer dans un lot signature dédié
- [x] `TZ-03` `TZ-04` `TZ-05` substitution frontend (le store de région est déjà disponible)
- [x] `TZ-08` exemple de template

**Dépendances** : aucune. **Recette** : réserver un créneau sur `app-annemasse`, mail de received conforme à `Europe/Paris` ; idem Réunion. Vérifier l'enveloppe de signature Réunion.
**Pourquoi en premier** : correctif autonome, rapide, sur un défaut visible **chaque jour** aux deux tenants.

**Livré en plus du périmètre initial** (trouvés pendant le lot) :

- six routes `/:signature/*` dupliquées dans `back/src/rest/external/route.ts`, supprimées ;
- `back/test/helpers/seedOffer.ts` écrivait l'offre via un modèle Mongo singleton, ignorant l'ALS : les offres de test partaient systématiquement en Réunion, ce qui masquait le défaut de fuseau ;
- garde ESLint frontend interdisant tout fuseau IANA ou décalage UTC en dur hors `src/lib/timezone.ts` ;
- `GET /:signature/profile` expose désormais `timezone` aux pages guest.


### Lot 2 — Profil tenant & identité (`ID-*`) · M

**Périmètre** : créer l'entité manquante, puis substituer.

- `ID-12` table `tenant_profiles` (MySQL, une ligne par base) : raison sociale, forme juridique, capital, SIRET, RCS, TVA, NDA, UAI, Qualiopi, siège, hébergeur, tel, email, contacts, `app_base_url`, `frontend_base_url`, timezone, couleur de marque
- `ID-12` faire de `APP_BASE_URL` / `FRONTEND_BASE_URL` un fallback, résolus par tenant via le profil
- `ID-01` `ID-02` `ID-03` `ID-04` `ID-07` `ID-06` substitution dans `PdfService` + catalogue PDF par tenant
- `ID-08` `ID-09` `ID-10` `ID-11` pipeline de substitution des pages légales, versionnées par tenant + garde de région sur `/legal/*`
- `ID-14` `ID-15` `ID-13` CSP, Sentry, `allowedHosts`
- `ID-17` `ID-18` `ID-19` `ID-20` `ID-21` emails système, signatures, emails RH intervieweurs
- `ID-05` emitter des PDF de signature par tenant (ou acter que le mandat reste Réunion — **à trancher**, §8)

**Dépendances** : `DEBT-08` tranché. **Recette** : un PDF de convention et un AB signé Annemasse ne contiennent plus aucune chaîne `974`/`0693`/SIRET Réunion ; `/legal/mentions` affiche le profil Annemasse ; zéro `[[PLACEHOLDER]]` visible.
**Note d'identité** : **même société, établissement distinct** ⇒ raison sociale partagée, SIRET/RCS/NDA/UAI/contacts propres par tenant.

### Lot 3 — Référentiel géographique (`GEO-*`, `SEED-*`) · L

Découpage en sous-étapes, **chacune validée séparément** :

1. **`SEED-01`** corriger le jeu de données Annemasse pour qu'il utilise la vraie géographie Annemasse — **préalable, sinon rien n'est mesurable**
2. **`GEO-01` → `GEO-04`** collections Mongo par tenant (`sectors`, `communes`, `training_sites`) chargées au boot depuis un JSON versionné ; les 5 énumérations deviennent des données. Suppression des 5 énumérations TS et des validateurs `enum` Mongo. Les 26 communes réunionnaises restent valides (aucune migration de données existantes)
3. **`GEO-05` → `GEO-08`** matching refactoré sur le référentiel, avec correction de l'asymétrie push/pull (`GEO-07`) et rendement des rejets visibles (`GEO-08`)
4. **`GEO-09` → `GEO-14`** propagation : `sector.ts`, `ALLOWED_SECTORS`, seed `sector_settings` par tenant, Drive, KPI, agenda, `NeedsAnalysisService`
5. **`GEO-15` `GEO-16`** front : `constants/secteurs.ts` alimenté par le référentiel, 12 écrans, `reunionCommunes.ts` → référentiel national ou par tenant avec autocomplétion CP nationale
6. **`SEED-02` → `SEED-05`** scripts Python : faire **échouer** l'import explicitement hors périmètre au lieu du fallback silencieux `Nord-Est`
7. **`COS-01` → `COS-02` `COS-07`** libellés de sites, adresses de hubs, défaut de département de naissance

**Dépendances** : sous-étape 2 conditionne toutes les autres. **Recette** : un AB Annemasse réel (adresse `74100`, secteur Annemasse) propose des candidats Annemasse réels, et symétriquement côté candidat.
**Correction préalable** : `SEED-01` doit être fait **avant** la sous-étape 3 pour être vérifiable.

### Lot 4 — Dette transversale (`DEBT-*`) · S

`DEBT-01` (défaut `region`) · `DEBT-02` (`export default pools.reunion` — piège de test) · `DEBT-04` (contrainte DB sur `region`) · `DEBT-05` (défauts `LIKE`) · `DEBT-06` (docs) · `DEBT-07` (typo) · `DEBT-08` `DEBT-09` (incohérences d'identité) · `DEBT-10` (clôture `FE-3`) · suppression de `front/.../src/data/nafCodes.ts` et `mockCandidates.ts` (morts).

---

## 8. Questions ouvertes

À trancher avant de démarrer le Lot 2 :

| # | Question | Enjeu |
|---|---|---|
| 1 | **Forme juridique** de l'établissement Annemasse (cf. `DEBT-08` : `EURL` vs `SARL`) | Détermine la valeur du profil tenant et corrige une contradiction qui existe déjà pour la Réunion |
| 2 | Valeurs Annemasse de `NDA`, `UAI`, `Qualiopi` | Champs obligatoires des mentions légales (`ID-08`, `ID-10`) |
| 3 | Annemasse a-t-il **un seul secteur** ou plusieurs ? | Détermine si `GEO-12` / `GEO-14` doivent supporter le multi-secteur dès Annemasse (sinon on code un cas dégénéré) |
| 4 | Liste des sites de formation Annemasse | `GEO-02` — aujourd'hui 3 sites Réunion ; Annemasse en a combien ? |
| 5 | Le **catalogue PDF** et le **mandat de signature** doivent-ils exister séparément pour Annemasse, ou rester Réunion ? | `ID-05` `ID-06` —Certificates et documents juridique ne sont pas paramétrables trivialement |
| 6 | Périmètre géographique de la **mobilité candidats** : communes d'Annemasse seulement, ou tout le département 74 ? | `GEO-01` `GEO-16` — détermine la taille du référentiel à saisir |
| 7 | Le tenant Réunion doit-il être **re-rempli** si ses `sector_settings` ont déjà été customized ? | `GEO-11` — `INSERT IGNORE` ne corrige rien ; faut-il un script de mise à jour ? |
| 8 | Un administrateur doit-il pouvoir **éditer le référentiel** (communes, secteurs) depuis l'UI, ou est-il versionné en JSON dans le dépôt ? | Détermine si le Lot 3 sous-étape 2 s'arrête aux collections Mongo ou va jusqu'à un écran d'administration |

---

## 9. Références croisées

| Sujet | Où c'est déjà suivi |
|---|---|
| Copies du vocabulaire secteur | `BACKLOG.md:154` (`DB-12`), `BACKLOG.md:168` (`API-6`) |
| `SECTEUR_VALUES` redéclaré dans 5 écrans | `BACKLOG.md:178` (`FE-3`) — **périmé**, à clôturer (`DEBT-10`) |
| Placeholders / identité légale | `docs/legal_mention_to_complete.md` (corpus cadre Réunion, pas encore multitenant) |
| Secrets weak, Sentry DSN en dur | `BACKLOG.md:214` (`RGPD-6`, `F11`), `RGPD.md:1058` |
| Vue RH par zone géographique NORD/OUEST/SUD | `BACKLOG.md` Partie 1.2 — dépend entièrement du Lot 3 |
| Multitenancy initial | `CHANGELOG.md:37-38` (`#709`, `#716`, `#717`, `#718`, `#724`, `#730`, `#731`) |
