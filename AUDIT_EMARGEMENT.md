# AUDIT ÉMARGEMENT — Écarts entre le cahier des charges et l'implémentation

Audit **lecture seule** du module émargement (`back/src/rest/emargement/`, `back/src/services/EmargementService.ts`,
`back/src/repositories/mongo/`, `front/disciplina-front/src/pages/emargement/`, `pages/peda/Emargement*`).
Aucun code modifié. Tous les constats sont référencés `fichier:ligne` et ont été vérifiés dans le code.

- **Périmètre** : commit `006398a1` — `feat (#955): Initial emargement section and logic`, branche `955-feat-emargement-section`, working tree propre
- **Date** : 2026-10-30
- **Documents liés** : `CHANGELOG.md`, `E2E.md` (§ 3.14 bis), `RGPD.md`, `database/mongodb/mongo-schema.md`, `back/README.md`

> **Nature du document.** Les sections 1 à 5 décrivent l'état au commit `006398a1` (audit lecture
> seule). La section **6** journalise les lots corrigés depuis : elle fait foi sur l'état courant.

> **Verdict.** Le socle « séance → formateur → QR → signature formateur » est en place et de bonne
> facture technique (horodatage serveur, jetons HMAC, fenêtres contrôlées serveur, verrouillage après
> signature). Mais c'est un **POC d'émargement**, pas encore un outil conforme : sur **57 exigences**,
> **9 sont satisfaites**, **21 partielles**, **27 absentes**. Les manques bloquants sont l'**identité du
> signataire** (§3), les **absences / justificatifs / notifications** (§6), les **exports** (§8), les
> **tableaux de bord** (§7) et l'**archivage / réversibilité** (§11).
>
> **État au 2026-10-30 après le lot 1** (données affichées : organisme + logo, titre pro, module, lieu,
> financeur — cf. §6) : **12 satisfaites**, **20 partielles**, **25 absentes**.
>
> **État au 2026-10-30 après le lot 2** (séance et signature de secours : créneaux bornés aux horaires
> de séance, fermeture à la fin du créneau, lien formateur valable J+7, signature manuscrite de
> l'alternant tracée chez le formateur — cf. §6) : **14 satisfaites**, **18 partielles**,
> **25 absentes**.

Légende :
**✅ FAIT** = conforme à l'exigence ·
**⚠️ PARTIEL** = socle présent, exigence non tenue en l'état ·
**❌ ABSENT** = aucune implémentation.

---

## 1. Cartographie de l'existant

| Couche | Fichiers |
|---|---|
| Modèle de domaine | `back/src/types/emargement.types.ts` |
| Schémas Mongo | `back/src/db/mongo/schemas/seance.schema.ts`, `emargement.schema.ts` (+ enregistrement dans `db/mongo/tenant.ts:56-57`) |
| Service | `back/src/services/EmargementService.ts` (806 l.), `emargementTokens.ts`, `emargementInviteTemplate.ts` |
| Dépôts | `back/src/repositories/mongo/SeanceRepository.ts`, `EmargementRepository.ts` |
| API staff | `POST/GET/PUT/DELETE /api/emargement/seances…` — `back/src/rest/emargement/route.ts` (rôles AD/GESTION/PEDA) |
| API publique | `GET\|PUT /api/emargement/formateur/:token[/attendance]`, `POST …/attendance/sign` (signature manuscrite de l'alternant), `POST …/sign`, `GET\|POST /api/emargement/sign/:token` — `public.route.ts` |
| UI Peda | `front/…/pages/peda/Emargements.tsx`, `EmargementSeance.tsx`, `components/peda/SeanceFormModal.tsx` |
| UI publique | `front/…/pages/emargement/FormateurEmargement.tsx`, `PublicSigning.tsx`, `components/emargement/PublicShell.tsx` |
| Client API / types | `front/…/api/emargement.ts`, `types/emargement.ts`, `utils/emargement.ts` |
| Tests | `back/src/rest/emargement/__tests__/emargement.test.ts` (12 cas) |

---

## 2. Tableau de conformité par section

| § | Exigence | État |
|---|---|---|
| 1 | Données obligatoires sur la feuille | ⚠️ 6/7 (groupe, titre pro + module, site + lieu, date/horaires, noms, formateur, financeur) — sites non configurables |
| 2 | Découpage des séances | ✅ 2.1 / 2.2 / 2.3 / 2.4 — créneaux bornés aux horaires, signature de secours, lien J+7 |
| 3 | Authentification & identité | ❌ identité = e-mail saisi, QR partagé, formateur sans compte |
| 4 | Horodatage & intégrité | ⚠️ 4.1 / 4.2 ✅ à la signature — **aucune traçabilité des corrections** |
| 5 | Validation par le formateur | ⚠️ 5.2 ✅ — 5.1 par journée au lieu de demi-journée, 5.3 ❌ |
| 6 | Absences et retards | ❌ 0/5 |
| 7 | Tableaux de bord et suivi | ❌ 0/4 (7.4 partiel via l'archivage alternant) |
| 8 | Exports et justificatifs | ❌ 0/5 |
| 9 | Sessions d'examen titre pro | ❌ 0/4 |
| 10 | Rôles et droits d'accès | ⚠️ 4 rôles internes seulement — pas d'apprenant, pas d'employeur |
| 11 | Archivage | ❌ 0/4 |
| 12 | RGPD et sécurité | ⚠️ 12.3 / 12.6 ✅ — le reste partiel ou hors code |
| 13 | Ergonomie | ⚠️ responsive ✅ — offline / PWA / a11y / import planning ❌ |

---

## 3. Détail exigence par exigence

### 3.1 §1 — Données obligatoires sur chaque émargement

> **Mise à jour du 2026-10-30** (lot 1 « données affichées », branche `955-feat-emargement-section`) :
> **1.1, 1.2 et 1.7 sont traités** et **1.3 partiellement** (lieu libre ajouté, sites toujours énumérés).
> Les constats ci-dessous décrivent l'état au commit `006398a1` ; le détail des correctifs est en §6.

| # | État | Constat | À faire |
|---|---|---|---|
| 1.1 | ✅ FAIT <br>(traité 2026-10-30) | ~~Aucun nom d'organisme ni logo.~~ `PublicShell.tsx` porte désormais un en-tête organisme : `Logo` (`variant="mark"`) + « Disciplina » + « Organisme de formation », réutilisé par la page formateur et la page QR. Reste à reprendre ce même bloc en tête des exports PDF (cf. §8). | En-tête organisme + logo sur les pages publiques et sur le futur PDF. |
| 1.2 | ✅ FAIT <br>(traité 2026-10-30) | ~~Seul le groupe est présent.~~ `degree_title` est snapshoté sur la séance depuis `Session.filiere` à la création (et recalculé si la séance change de session) ; `module` (libellé libre, ≤ 120 car.) est saisissable sur la séance. Pas de référentiel module/séquence : le champ est libre, ce qui suffit à l'affichage mais ne permettra pas d'agréger par module. | Ajouter `degree_title` (snapshot) et une entité module/séquence (ou un champ libre) sur `Seance`. |
| 1.3 | ⚠️ PARTIEL | `site` = énumération figée `['Nord','Ouest','Sud','Annemasse']` (`emargement.types.ts:8`) + `mode` `salle\|distanciel` (`:12`). **Ajouté le 2026-10-30** : `location` (libellé libre, salle / adresse / lien visio) affiché sur la feuille à la suite du site et de la modalité. Restent les **sites configurables** (aujourd'hui codés en dur). | Champ `room`/`location` libre ✅ + sites configurables. |
| 1.4 | ✅ FAIT | `date`, `start_time`, `end_time` (`emargement.types.ts:36-39`). | — |
| 1.5 | ✅ FAIT | Liste des inscrits lue à la volée (`sessions.findAlternants`, `EmargementService.ts:246`) + snapshot nom/prénom par ligne (`EmargementRepository.upsert`). | — |
| 1.6 | ✅ FAIT | `formateur_name` (`emargement.types.ts:42`). Attention : texte libre, **non relié à un compte utilisateur** (cf. 3.4). | — |
| 1.7 | ✅ FAIT <br>(traité 2026-10-30) | ~~Aucun champ financeur/OPCO sur l'alternant.~~ `Alternant.financeur` (libellé libre, saisi sur la fiche alternant avec suggestions OPCO) est exposé dans `AlternantEmargementDto` et affiché sous le nom de l'alternant sur les feuilles Peda et formateur. Reste à le porter sur les exports (cf. §8). | Ajouter le financeur au dossier alternant ✅ + le porter sur les exports. |

### 3.2 §2 — Découpage des séances

> **Mise à jour du 2026-10-30** (lot 2 « séance et signature de secours », branche
> `955-feat-emargement-section`) : **2.3 et 2.4 sont traités**. Détail des correctifs en §6.

- **2.1 ✅ FAIT** — Deux enregistrements distincts `morning` / `afternoon`, avec index unique
  `(seance_id, alternant_id, half)` (`emargement.schema.ts:29`).
- **2.2 ✅ FAIT** — Aucune signature journalière côté apprenant : `signByQr` écrit toujours sur la
  demi-journée ouverte (`EmargementService.ts:511`).
- **2.3 ✅ FAIT** <br>(traité 2026-10-30) — Fenêtres paramétrables et **contrôlées côté serveur**
  (`openHalf`, refus 409 `window`), désormais **bornées aux horaires de la séance** :
  `assertWindowInsideSeance` (`EmargementService.ts`) refuse en 400 `validation` une ouverture avant
  `start_time` ou une fermeture après `end_time`, matin et après-midi, et le formulaire Peda
  (`SeanceFormModal.tsx`) applique les mêmes bornes (`min`/`max` + messages). ~~Signature possible
  avant le début / après la fin de la séance.~~ L'option « signature manuelle en cas de problème »
  existe maintenant comme **vraie signature de l'apprenant** : mode `handwritten`, tracée sur
  l'appareil du formateur (`POST /api/emargement/formateur/:token/attendance/sign`), disponible tant
  que la feuille est éditable — donc **pas limitée au jour même**.
- **2.4 ✅ FAIT** <br>(traité 2026-10-30) — Fermeture automatique à la fin du **créneau**
  (`openHalf` → `null`, `windowState` `closed`), indépendamment de la fin de la séance, et
  `invite_expires_at` = **fin du jour J + 7 jours** (`EMARGEMENT_GRACE_DAYS`, `linksExpiry`) : après
  minuit, le formateur peut encore saisir, faire signer à la main et signer la feuille. Le QR
  alternant, lui, reste fermé par son créneau — le jeton plus long est donc inerte côté apprenant.

### 3.3 §3 — Authentification et identité — **écart majeur**

- **3.1 ❌ ABSENT** — Pas d'identifiant personnel : **un QR unique pour toute la séance**
  (`/emargement/sign/:token`, dérivé de `token_secret`, `emargementTokens.ts:19-22`) et l'identité
  est **l'e-mail que l'apprenant tape lui-même** (`signByQr`, `EmargementService.ts:499-552`).
  Aucun QR nominatif dynamique, aucun code unique, aucun lien personnel, aucun compte apprenant.
- **3.2 ❌ ABSENT** — « Impossible de signer pour quelqu'un d'autre » **n'est pas garanti** :
  quiconque connaît l'e-mail d'un camarade peut signer à sa place. Mitigations existantes : message
  d'erreur générique (anti-énumération, `:519-521`), rate-limit 300 req/min
  (`rest/middleware/rateLimiter.ts:90-96`), IP + user-agent journalisés. Insuffisant pour une preuve
  d'assiduité opposable.
- **3.3 ⚠️ PARTIEL** — Signature électronique simple eIDAS : horodatage serveur ✅, lien avec le
  document ✅ (`seance_id` + `alternant_id`), **vérification d'identité ❌** (simple connaissance d'un
  e-mail), pas d'artefact de consentement au-delà du clic. Depuis le lot 2, une **signature manuscrite
  de l'apprenant** existe en repli (tracée sur l'appareil du formateur, mode `handwritten`), mais elle
  reste une signature de proximité, non vérifiée à distance.
- **3.4 ❌ ABSENT** — Le formateur **ne s'authentifie pas** : il reçoit un lien de capacité par e-mail
  (`EmargementService.ts:662-668`), transmissible, sans login, sans MFA, sans rattachement à un
  compte (`formateur_name` / `formateur_email` saisis par le Peda).

### 3.4 §4 — Horodatage et intégrité

- **4.1 ✅ FAIT** — `new Date()` côté serveur uniquement (`EmargementService.ts:462`, `:510`), ISO
  avec millisecondes ; l'heure client n'est jamais utilisée pour la preuve.
- **4.2 ⚠️ PARTIEL** — Par signature : `signed_at`, `alternant_id`, `ip`, `user_agent`,
  `signature_mode` (+ `first_signed_at` / `first_signature_mode`). Pour la signature de la feuille :
  `signed_at`, `signed_ip`, `signed_user_agent`, `signed_by_name` (mode implicite).
  **Mais** `EmargementRepository.upsert` (`EmargementRepository.ts:50-87`) **écrase** `status`, `ip`,
  `user_agent`, `signed_at` à chaque correction → **aucun historique**, aucune trace de « qui a
  corrigé quoi et pourquoi ». Bloquant pour 8.3 et 10.4.

### 3.5 §5 — Validation par le formateur

- **5.1 ❌/⚠️** — Une **seule signature pour toute la journée** (`signSheet`,
  `EmargementService.ts:445-474`), pas une par demi-journée. Et elle est possible **avant la
  fermeture des créneaux** : `signSheet` ne vérifie que « non signée » (`:447`) et « non expirée »
  (`:448`). La mention « une fois les créneaux passés » a été retirée du `CHANGELOG.md` (lot 2) ; le
  contrôle lui-même reste à implémenter (défaut **D**).
- **5.2 ✅ FAIT** — Présent / absent / en retard (+heure) / parti en avance (+heure) :
  `setAttendance` (`:409-443`), `status_time` (`emargement.types.ts:77`).
- **5.3 ❌ ABSENT** — Aucune détection d'anomalie : pas de statut « non validée », pas d'alerte, pas
  de liste. Seul un badge « En cours » / « Signée » dans la liste (`Emargements.tsx:160-166`).
  Aggravant : après minuit la feuille ne pouvait **plus jamais** être signée (410) et le Peda n'a
  **aucun moyen de la valider lui-même** → anomalie définitive et non résoluble (défaut **B**).
  Le lot 2 porte le lien formateur à J+7 (le formateur peut donc régulariser) ; la validation par le
  Peda reste absente.

### 3.6 §6 — Gestion des absences et retards — **section entièrement absente**

- **6.1 ❌** Pas de distinction justifiée / non justifiée, pas de motif (`EMARGEMENT_STATUSES` =
  `na|present|absent|late|left_early`, `emargement.types.ts:23`).
- **6.2 ❌** Aucun dépôt de justificatif (PDF/photo) : pas de stockage fichier sur ce module.
- **6.3 ❌** Aucune notification d'absence (apprenant / chargée relation apprenti / employeur).
  Le seul e-mail du module est l'invitation au formateur (`sendInvite`, `EmargementService.ts:756-801`).
- **6.4 ❌** Aucun historique de relances / notifications.
- **6.5 ❌** Aucun seuil d'alerte paramétrable.
  > À noter : des modèles « Relance absence — niveau 1/2/3/+ » existent (`services/pedaDefaultTemplates.ts`),
  > mais ils sont pilotés par un **Google Sheet** externe (`pages/peda/SuiviAbsences.tsx` +
  > `scheduler/pedaDraftScheduler.ts`), **sans aucun lien avec les données d'émargement**.

### 3.7 §7 — Tableaux de bord et suivi

- **7.1 ❌** Aucun taux d'assiduité (apprenant / groupe / site / période). `pages/peda/DashboardPeda.tsx`
  ne traite que les SA (séquences). Aucune agrégation côté back : `EmargementRepository` n'expose que
  `countsBySeance` (`EmargementRepository.ts:98-117`).
- **7.2 ❌** Aucun calcul heures prévues / réalisées (le statut demi-journée n'est pas converti en
  durée ; il faudrait `start_time`/`end_time` × présence).
- **7.3 ❌** Aucune liste « feuilles incomplètes / non validées » (pas de filtre, pas de notion
  d'anomalie — cf. 5.3).
- **7.4 ⚠️ PARTIEL** — Le socle existe : `archived_at` + `archive_reason ('rupture'|'fin_formation')`
  (`alternant.schema.ts:47-48`), module Ruptures avec `poursuitFormation`
  (`services/RuptureService.ts:49-68`), et les archivés sont **exclus** de `findAlternants`
  (`AlternantRepository.findBySessionOrFilizClassId`, `:69-73`) → pas d'émargement attendu après une
  sortie ✅. Manquent : statut + **date d'effet** affichés sur la feuille, distinction « rupture qui
  reste en formation », et possibilité d'inclure les archivés dans un export historique.

### 3.8 §8 — Exports et justificatifs — **section entièrement absente**

- **8.1 ❌** Aucun export PDF (par séance / par apprenant / par groupe) : aucune route, aucun bouton,
  aucun gabarit.
- **8.2 ❌** Aucun export Excel/CSV des présences et des heures.
- **8.3 ❌** Aucun journal d'audit (rien à exporter — cf. 4.2).
- **8.4 ❌** Aucun modèle PDF paramétrable (charte Disciplina / Région / FSE+).
- **8.5 ❌** Aucune attestation d'assiduité.

> Réutilisable : `services/PdfService.ts` (pdfkit + puppeteer) et l'export xlsx de `services/KpiService.ts`.

### 3.9 §9 — Sessions d'examen titre professionnel

**9.1 → 9.4 : ❌ intégralement absent.** Pas d'émargement candidats, pas de jury, pas de rattachement
de documents (convocations / PV / grilles), pas d'export DEETS. Aucune collection, aucun écran.
Chantier séparé à ouvrir.

### 3.10 §10 — Rôles et droits d'accès

| # | État | Constat |
|---|---|---|
| 10.1 | ⚠️ PARTIEL | L'apprenant peut **signer** (lien public), mais **ne peut pas consulter ses présences** : aucun rôle `APPRENANT` (`front/…/store/authStore.ts:4-11`), aucun portail apprenant. |
| 10.2 | ⚠️ PARTIEL | Le formateur gère **sa** feuille (statuts, absences, signature) via son jeton, mais ne peut ni créer ni gérer ses séances (réservé au Peda). |
| 10.3 | ⚠️ PARTIEL | Accès PEDA/AD/GESTION OK (`rest/emargement/route.ts:11`), mais **aucun export**, aucune relance. |
| 10.4 | ⚠️ PARTIEL | AD/GESTION ont tout, mais pas d'exports ; **pas de « correction motivée »** (corrections non motivées, non tracées, uniquement côté formateur) ; l'écran Peda est **en lecture seule** (`EmargementSeance.tsx` — aucune saisie). |
| 10.5 | ❌ ABSENT | Aucun accès employeur : le portail `ENTREPRISE` n'expose rien sur l'assiduité. |

### 3.11 §11 — Archivage

- **11.1 ❌ ABSENT** — Aucune durée de conservation paramétrable, aucun scheduler de purge/rétention
  (`back/src/scheduler/` : `abSignatureRelance`, `expiredAccess`, `filizSync`, `immersionEnd`,
  `pedaDraft`, `saNotification`, `unavailableExpiry` — aucun n'est lié à l'émargement).
  Pire : la ligne ajoutée dans `RGPD.md` dit « conservation **avec la séance et la session d'origine** »
  → **contradiction directe** avec les ≥ 10 ans exigés.
- **11.2 ⚠️ PARTIEL** — Une feuille signée est verrouillée (409, `EmargementService.ts:298`, `:351`,
  `:447`) donc non modifiable, mais rien n'est « archivé » et surtout **rien n'est exportable** (§8).
- **11.3 ⚠️ PARTIEL** — Sauvegardes uniquement **au déploiement** (`scripts/deploy.sh:171-182` →
  `scripts/backup-db.sh`, mysqldump/mongodump). Pas de sauvegarde planifiée, pas de politique de
  rétention des dumps.
- **11.4 ❌ ABSENT** — Aucun export complet / réversibilité.

### 3.12 §12 — RGPD et sécurité

- **12.1 ⚠️** Hors code (infra). À arbitrer : le tableau `RGPD.md` du module mentionne **Google (USA)**
  pour l'envoi de l'invitation → à documenter/justifier vis-à-vis de l'exigence « hébergement UE / HDS ».
- **12.2 ⚠️** HTTPS = infra. Bon point : liens publics sans cookie (`credentials: 'omit'`,
  `api/emargement.ts:109-114`), jetons HMAC non stockés. Mais jeton **dans l'URL** (fuite possible via
  logs / referrer) et aucun compte ni mot de passe côté formateur.
- **12.3 ✅ FAIT** — Pas de géolocalisation, collecte limitée (nom, e-mail, statut, horodatage, IP, UA,
  signature manuscrite de l'alternant uniquement en repli `handwritten`, déclarée dans `RGPD.md`).
  ⚠️ Durée de conservation de l'IP/UA non documentée.
- **12.4 ⚠️ PARTIEL** — Pied de page légal générique présent (`components/legal/PublicLegalFooter.tsx`)
  + une ligne « l'heure, l'adresse IP et l'appareil utilisés sont enregistrés »
  (`PublicSigning.tsx:225-227`). **Pas de mention d'information spécifique émargement ni de durée de
  conservation affichée.**
- **12.5 ⚠️ PARTIEL** — Droit d'accès/rectification génériques (page confidentialité) ; aucune
  procédure concrète pour consulter/rectifier ses propres émargements.
- **12.6 ✅ FAIT** — Ligne ajoutée dans `RGPD.md` pour #955.

### 3.13 §13 — Ergonomie

- **13.1 ⚠️ PARTIEL** — Web responsive OK (Tailwind, pages publiques mobiles). **Pas de PWA** :
  aucun `manifest`, aucun service worker, pas d'option « application ».
- **13.2 ❌ ABSENT** — Aucun mode hors-ligne / file d'attente / synchronisation. Le seul secours est la
  saisie manuelle par le formateur, qui **ne conserve pas l'horodatage d'origine** de l'apprenant.
- **13.3 ⚠️ PARTIEL** — `aria-label` sur les selects, `alt` sur les images, tableaux sémantiques.
  Mais `components/ui/SignaturePad.tsx` est un `<canvas>` **sans rôle, sans libellé ARIA, sans
  alternative clavier** ; pas d'audit de contraste, pas de gestion du focus sur les pages publiques.
- **13.4 ⚠️ PARTIEL** — Multi-groupes OK (séance → session). Multi-sites limité à **4 valeurs codées en
  dur** ; **aucun import de planning Excel/CSV** (création séance par séance).

---

## 4. Défauts transverses à corriger

Indépendamment du cahier des charges, ces points sont des bugs ou des dettes à traiter.

| # | Défaut | Impact | Emplacement |
|---|---|---|---|
| A | **Changer la session d'une séance laisse les émargements orphelins** : `update()` change `session_id` sans purger `emargements` → la feuille mélange deux groupes et les compteurs `marked`/`present` sont faux. | Intégrité des données | `EmargementService.ts:296-346` |
| B | **Aucune remédiation après la fin de journée** : `invite_expires_at` = minuit ; `assertEditable` / `signSheet` renvoient 410 → une feuille non validée est **définitivement** bloquée, sans signature Peda possible. **Corrigé le 2026-10-30 (lot 2)** : `invite_expires_at` = fin du jour J + 7 jours (`EMARGEMENT_GRACE_DAYS`), donc le formateur peut encore corriger et signer. La remédiation **côté Peda** (écran + action de validation) reste à faire. | Bloque 5.3 et toute correction a posteriori | `EmargementService.ts` (`linksExpiry`) |
| C | **Fenêtres non bornées aux horaires de séance** (cf. 2.3). **Corrigé le 2026-10-30 (lot 2)** : `assertWindowInsideSeance` refuse en 400 `validation` une ouverture avant `start_time` ou une fermeture après `end_time` (matin et après-midi), et `SeanceFormModal` applique les mêmes bornes. | Preuve contestable | `EmargementService.ts` (`parseSeanceInput`), `SeanceFormModal.tsx` |
| D | **Signature formateur = 1 par jour, sans contrôle de fermeture des créneaux.** | Non conforme 5.1 ; le CHANGELOG/E2E annoncent un comportement non implémenté | `EmargementService.ts:445-474` |
| E | **Aucune trace d'audit des corrections** : `upsert` écrase statut / IP / UA / heure. | Bloque 8.3 et 10.4 | `EmargementRepository.ts:50-87` |
| F | **Identité = e-mail saisi + QR partagé.** | Bloque 3.1 / 3.2, affaiblit 3.3 | `EmargementService.ts:499-552` |
| G | **Liste plafonnée à 200 séances sans pagination.** | Bloque dashboards et exports historiques | `SeanceRepository.ts:23-28` |
| H | **Aucune unicité `(session, date, début)`** → séances en doublon possibles. | Qualité de données | `seance.schema.ts:35-36` |
| I | **Écran Peda en lecture seule** : le Peda ne peut pas saisir ni corriger une présence. | Gêne opérationnelle (10.4) | `pages/peda/EmargementSeance.tsx` |
| J | **Incohérence documentaire** : `CHANGELOG.md` et `E2E.md` § 3.14 bis affirment « signature une fois les créneaux passés » — faux. **Corrigé le 2026-10-30 (lot 2)** : la mention a été retirée de `CHANGELOG.md` ; le comportement lui-même reste à implémenter (défaut **D**). | Confiance dans la doc | `CHANGELOG.md`, `E2E.md` |

---

## 5. Plan de rattrapage

### P0 — conformité de la preuve (bloquant juridiquement)

1. **Identité du signataire** (§3.1 / 3.2 / 3.3) : QR nominatif dynamique ou lien personnel signé par
   apprenant + vérification (OTP e-mail ou lien à usage unique), journalisation du mode.
2. **Authentification formateur** (§3.4) : compte utilisateur + rattachement (`user_id`) sur la séance.
3. **Journal d'audit append-only** des saisies/corrections (§4.2, 8.3) + motif de correction (§10.4).
4. **Signature par demi-journée** et contrôle de fermeture des créneaux (§5.1) ; ~~**bornage des fenêtres**
   aux horaires de séance (C)~~ ✅ lot 2 ; ~~**remédiation post-journée** (B)~~ ✅ lot 2 pour le délai de
   régularisation (reste la validation côté Peda, §5.3).
5. Corriger les défauts **A**, **G**, **H**.

### P1 — exploitation quotidienne

6. Absences justifiées / non justifiées + motif + justificatif (§6.1 / 6.2).
7. Notifications automatiques apprenant / CFA / employeur + historique + seuil (§6.3–6.5).
8. Exports PDF (séance / apprenant / groupe), Excel/CSV, attestations (§8.1 / 8.2 / 8.5), en réutilisant
   `PdfService`.
9. Tableaux de bord assiduité + heures prévues/réalisées + feuilles non validées (§7.1–7.3).
10. En-tête organisme + logo, titre pro, module/séquence, salle/lieu, financeur (§1.1 / 1.2 / 1.3 / 1.7).
    **Traité le 2026-10-30 pour l'affichage écran** — voir §6 ; reste la reprise de ces données dans les
    exports PDF/CSV (point 8).

### P2 — durcissement

11. Archivage / rétention paramétrable ≥ 10 ans + export de réversibilité (§11) — et **corriger la ligne
    RGPD** actuelle.
12. Rôles apprenant et employeur (§10.1 / 10.5), écran de correction motivée (§10.4).
13. Offline / sync (§13.2), PWA (§13.1), accessibilité du `SignaturePad` et audit de contraste (§13.3),
    sites configurables + import de planning (§13.4).
14. Module examens titre pro (§9) — chantier séparé.

### Hors code (infra / juridique)

Hébergement UE / HDS (12.1), sauvegardes planifiées et rétention des dumps (11.3), politique de
conservation contractuelle (11.1).

---

## 6. Journal des lots traités

### Lot 1 — données affichées sur l'émargement (2026-10-30)

Périmètre : rendre la feuille lisible sans changer le modèle de preuve. **Les exports PDF/CSV restent
hors périmètre** (point 8 du plan P1).

| Exigence | Correctif |
|---|---|
| 1.1 Organisme + logo | `components/emargement/PublicShell.tsx` porte un en-tête organisme (`Logo` `variant="mark"` + « Disciplina » + « Organisme de formation »), partagé par la page formateur et la page QR. Ce bloc est destiné à être réutilisé tel quel en tête des PDF. |
| 1.2 Titre pro + module | `Seance.degree_title` : snapshot de `Session.filiere` à la création (`EmargementService.create`), **recalculé** si la séance change de session (`EmargementService.update`) pour que la feuille ne garde pas l'intitulé de la promo précédente. `Seance.module` : libellé libre ≤ 120 car. (`optionalLabel`), saisi dans `SeanceFormModal`. |
| 1.3 Lieu | `Seance.location` : libellé libre ≤ 120 car. (salle, adresse, lien visio), affiché à la suite de `site` + `mode` via `seancePlace()`. **Les sites restent énumérés** (`SEANCE_SITES`). |
| 1.7 Financeur | `Alternant.financeur` : libellé libre (≤ 80 car., `null` si vide), saisi en place sur la fiche alternant avec un `datalist` de suggestions (`FINANCEUR_SUGGESTIONS`). Volontairement **non couplé** à l'enum `Opco` des analyses de besoin, pour accepter « Région », « France Travail », etc. Exposé dans `AlternantEmargementDto` et affiché sous le nom de l'alternant (feuilles Peda et formateur). **Non exposé au MCP** (`toAlternantDto` inchangé). |

Décisions de conception :

- **Snapshot plutôt que jointure** pour `degree_title` : la feuille doit rester identique à ce qui a été
  signé, même si la promo Filiz est renommée après coup.
- **Champs libres plutôt que référentiels** pour `module`, `location` et `financeur` : aucun référentiel
  module/séquence n'existe dans le code, et le financeur réel dépasse l'enum OPCO. Conséquence assumée :
  pas d'agrégation possible par module tant qu'un référentiel n'est pas introduit (§7).
- Aucune donnée nouvelle n'est exposée hors des feuilles : ni MCP, ni API publique supplémentaire.

Couverture : `back/src/rest/emargement/__tests__/emargement.test.ts` (titre pro, module, lieu, financeur
côté Peda et côté formateur) et `back/src/graphql/peda/__tests__/alternant.test.ts` (pose, effacement et
longueur maximale du financeur).

Reste à faire pour clore §1 : exports PDF/CSV portant ces cinq données (§8), sites configurables (§13.4).

### Lot 2 — séance et signature de secours (2026-10-30)

Périmètre : borner la preuve au temps réel du cours et donner une vraie signature de repli à l'apprenant.
**Les exports PDF/CSV restent hors périmètre** (point 8 du plan P1), ainsi que la signature par
demi-journée (§5.1) et la remédiation côté Peda (§5.3).

| Exigence | Correctif |
|---|---|
| 2.3 Créneaux bornés | `assertWindowInsideSeance` (`EmargementService.parseSeanceInput`) refuse en 400 `validation` `morning_start < start_time`, `morning_end > end_time`, et idem pour l'après-midi. `SeanceFormModal` applique les mêmes règles (`min`/`max` sur les champs heure + messages d'erreur) et ses valeurs par défaut ont été corrigées (matin 09:00–09:15, l'ancien 08:45 était hors bornes). |
| 2.3 Signature manuelle de l'apprenant | Nouveau mode `handwritten` (`EMARGEMENT_SIGNATURE_MODES`) et route `POST /api/emargement/formateur/:token/attendance/sign` (`signAttendanceManually`) : le formateur ouvre un `SignaturePad` depuis la ligne de l'alternant, celui-ci trace à la main. Le tracé est stocké dans `emargements.signature_image`, horodaté côté serveur avec l'IP / l'appareil du formateur, et affiché sur la page formateur et la feuille Peda. Autorisé tant que la feuille est éditable — **pas limité au jour même**. |
| 2.4 Fermeture au créneau + lien J+7 | La fermeture de la signature alternant reste portée par `openHalf` (fin du créneau, indépendante de la fin de séance). `invite_expires_at` = fin du jour J + `EMARGEMENT_GRACE_DAYS` (7) via `linksExpiry` : le formateur peut régulariser après minuit, le QR alternant restant fermé par son créneau. `resendInvite` repousse l'échéance (sinon le Peda renverrait un lien mort). |

Décisions de conception :

- **L'image est une pièce de preuve, pas un état** : `EmargementRepository.upsert` ne l'écrit qu'en mode
  `handwritten` ; une simple correction de statut qui reste une présence (`present` / `late` /
  `left_early`) la conserve, tandis qu'un passage à `absent` / `na` ou une nouvelle signature `qr`
  l'efface — elle ne prouverait plus la présence.
- **Validation d'image côté serveur** : `requireSignatureImage` (data-URL PNG/JPEG, ≤ 2,5 Mo) est
  partagée avec la signature de la feuille ; le corps public reste plafonné à 3 Mo.
- **Délai de 7 jours** plutôt que « jusqu'à clôture par le Peda » : aucun écran ni action de clôture
  n'existe encore côté Peda (défaut **B**, §5.3) ; le délai borne la fenêtre sans nouveau chantier.
- `addDays` de `utils/zonedTime.ts` est devenu `addDaysToDate` (exporté) et sert à `endOfLocalDay` comme
  à `linksExpiry`, pour éviter deux arithmétiques de dates divergentes.

Couverture : `back/src/rest/emargement/__tests__/emargement.test.ts` (12 cas) — créneau hors bornes
(matin et après-midi, ouverture et fermeture) → 400, bornes incluses acceptées ; `inviteExpiresAt` = fin
du jour J+7 locale et prolongée au renvoi de l'invitation ; signature manuscrite (statut `present`, image
exposée côté Peda, conservée sur correction de présence, effacée sur `absent`), signature absente → 400
`signature`, après-midi inexistant → 400 `window`.

Reste à faire pour clore §2 : rien — 2.1 à 2.4 sont conformes. Les manques voisins relèvent d'autres
sections : identité du signataire (§3), audit des corrections (§4.2 / 8.3), signature par demi-journée
(§5.1), remédiation Peda (§5.3), exports (§8).
