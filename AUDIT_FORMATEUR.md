# AUDIT FORMATEUR — Espace formateur (application côté intervenant)

Audit **lecture seule** de la faisabilité de l'espace formateur demandé : prochain créneau,
calendrier + indisponibilités, liste des séances, documents Drive et point d'entrée depuis la fiche
formateur du Peda.

- **Périmètre** : `back/src/` (REST, services, Mongo, Google), `front/disciplina-front/src/`
  (routes, layouts, pages Peda / émargement), `database/mongodb/`, `rgpd/RGPD.md`.
- **Date** : 2026-11-06.
- **État du dépôt** : lot « référentiel formateurs » (#955) implémenté mais **non commité** —
  `formateurs`, `formateur_history`, `/api/formateurs`, `/peda/formateurs/:id`.
- **Documents liés** : `AUDIT_EMARGEMENT.md`, `CHANGELOG.md`, `E2E.md`, `RGPD.md`,
  `database/mongodb/mongo-schema.md`, `back/README.md`, `front/disciplina-front/README.md`.

> **Nature du document.** C'est un audit **avant réalisation** : il constate l'existant, mesure
> l'écart avec la demande, propose une architecture et liste les décisions à arbitrer. Aucun code
> n'est modifié. Contrairement à `AUDIT_EMARGEMENT.md`, il n'y avait pas encore de « journal des
> lots » : il est **ouvert au §11** depuis le premier lot livré.
>
> **Mise à jour du 2026-11-12.** Le lot 1 (identité + coquille + accueil) est livré, et **D1 a été
> inversée** : l'identité passe par un **compte `users` avec `JobRole.FORMATEUR`** (option B), pas
> par une signature portée par la fiche. Les §3.1 et §5.1 décrivent encore l'option A : elles sont
> conservées comme trace de l'arbitrage, la conception retenue est au **§3.1 bis** et le détail du
> lot au **§11**.

> **Verdict.** La demande est **réalisable sans refonte**, mais elle bute sur un point qui n'existe
> pas encore : **le formateur n'a aucune identité applicative**. Aujourd'hui il ne possède qu'un
> lien de capacité par séance, valable J+7 en écriture, et le motif « guest » du projet **expire au
> bout de 15 minutes sans mécanisme de rafraîchissement** (`cookies.ts:31-46`, `env.ts:176`) : il
> n'est pas réutilisable tel quel pour une application personnelle. Les deux autres sujets
> structurants sont l'**indisponibilité** (aucune notion, aucun blocage à la création de séance) et
> le **stockage documentaire**, qui doit passer par le Drive d'un compte **Peda** puisque les
> comptes Google externes ne sont pas admis dans le projet GCP — ce qui impose une **section de
> paramétrage Drive côté Peda** et interdit tout partage public de fichier.
>
> Sur **9 exigences**, **1 est déjà satisfaite** (lien avec la fiche Peda, socle posé au lot
> précédent), **3 sont partielles** (prochain créneau, calendrier, mes séances : les données
> existent, l'espace et l'identité non), **5 sont absentes** (identité, indisponibilités, blocage à
> l'affectation, documents, paramétrage Drive).

Légende :
**✅ FAIT** = conforme à la demande ·
**⚠️ PARTIEL** = socle technique présent, fonctionnalité non livrée ·
**❌ ABSENT** = aucune implémentation.

---

## 1. Cartographie de l'existant

### 1.1 Identité et sessions

| Élément | Constat | Référence |
|---|---|---|
| Rôles métier | 5 rôles staff (`COMMERCIAL`, `RH`, `PEDA`, `AD`, `GESTION`) + 3 rôles JWT-only (`ENTREPRISE_GUEST`, `CANDIDATE_GUEST`, `EXTERNAL_GUEST`). **Aucun rôle formateur.** | `back/src/types/user.types.ts:1-17` |
| Middleware staff | `authenticate()` refuse explicitement tout jeton non staff (`403 Forbidden: guest token`) et applique le double-submit CSRF sur les méthodes mutantes. | `back/src/rest/middleware/auth.ts:13,27-32` |
| Motif « guest » | Jeton de capacité signé + **ligne en base vérifiée à chaque requête** (`status === 'LOCKED'` → 401), ce qui donne une révocation réelle. | `back/src/rest/external/guard.ts:16-57` |
| Émission du jeton guest | `signAccessToken({ role, permission, signature, referenceId })` puis cookie. | `back/src/services/ExternalAccessService.ts:192-200` |
| **Durée de vie** | Cookie d'accès = `ACCESS_TOKEN_TTL_SECONDS`, **15 min par défaut**, et **aucun refresh token** : « le lien magique reste rouvrable sans limite de durée ». | `back/src/rest/middleware/cookies.ts:31-46`, `back/src/config/env.ts:176` |
| Routage multi-tenant | La région est portée par la **signature** (`<sig>:<region>`) et résolue à chaque requête par `resolveExternalRegion`. | `back/src/rest/external/region.ts:11-17`, `back/src/db/tenant.ts` |
| Côté front | `AuthBootstrap` appelle `/api/auth/me` au montage ; `ProtectedRoute` n'autorise que les rôles staff ; le garde-fou de session ne réagit qu'aux **401** et tente `/api/auth/refresh`. | `front/.../src/components/AuthBootstrap.tsx:15-19`, `src/components/ProtectedRoute.tsx`, `src/lib/sessionGuard.ts:66-77` |

**Conséquence** : un espace formateur « qui dure » (calendrier, documents, indisponibilités) ne peut
pas s'appuyer sur le motif guest actuel sans ajouter une **ré-authentification silencieuse**.

### 1.2 Séances et rattachement formateur

| Élément | Constat | Référence |
|---|---|---|
| Lien séance → fiche | `seances.formateur_id` (nullable) + snapshots `formateur_name` / `formateur_email`. | `back/src/types/emargement.types.ts`, `db/mongo/schemas/seance.schema.ts` |
| Lecture par formateur | `findByFormateur(id, email)` : séances liées **ou** séances antérieures sans lien dont l'e-mail normalisé correspond. | `back/src/repositories/mongo/SeanceRepository.ts:48-67` |
| Résolution à l'enregistrement | `resolveForSeance()` lie par id, sinon par e-mail, sinon **crée la fiche**. | `back/src/services/FormateurService.ts:288-306` |
| Écritures | `EmargementService.create/update` appellent `resolveForSeance` puis écrivent le snapshot issu de l'annuaire. | `back/src/services/EmargementService.ts` (§ `create`, `update`) |
| Fuseau | Les dates de séance sont des `YYYY-MM-DD` en heure locale du tenant (`localDate`, `tenantTimezone`). | `back/src/utils/zonedTime.ts`, `back/src/config/tenant.ts` |
| Portée | Les collections Mongo sont **par région** (`modelOn(region, …)`), donc une fiche et ses séances vivent dans un seul tenant. | `back/src/db/mongo/tenant.ts:59-65` |

### 1.3 Émargement — liens de capacité

| Élément | Constat | Référence |
|---|---|---|
| Jeton | `<seanceId>.<hmac(token_secret, kind)>:<region>` ; aucun jeton brut stocké, recalculable à tout moment. | `back/src/services/emargementTokens.ts:20-23` |
| URL formateur | `${FRONTEND_BASE_URL}/emargement/formateur/<token>`, **dérivée à la lecture** (jamais persistée). | `back/src/services/EmargementService.ts:2064-2070` |
| Expiration en écriture | `invite_expires_at` = fin du jour J + **7 jours** (`EMARGEMENT_GRACE_DAYS`). | `back/src/services/EmargementService.ts:77-81`, `:1988` |
| Expiration en lecture | `loadByToken` **ne contrôle pas** `invite_expires_at` : la feuille reste consultable, mais `editableHalves` est vide et toute écriture échoue en `410`. | `back/src/services/EmargementService.ts:1954-1962`, `:2062-2066` |
| Renvoi d'invitation | Peut **tourner `token_secret`** : les anciens liens meurent. | `back/src/services/EmargementService.ts:1409-1414` |
| Page publique | `FormateurEmargement` gère déjà `expired` / `canEdit` en lecture seule. | `front/.../src/pages/emargement/FormateurEmargement.tsx:310,396,498` |

**Conséquence** : l'espace formateur doit **recalculer** le lien au moment de l'affichage, jamais le
stocker. C'est aussi ce qui rend l'accès depuis « Prochain créneau » et « Mes séances » trivial côté
back.

### 1.4 Google et Drive

| Élément | Constat | Référence |
|---|---|---|
| Scopes | `drive` (complet), `calendar`, `gmail.modify`, `spreadsheets.readonly` — un seul client OAuth par tenant. | `back/src/external/google/oauth-client.ts:7-16` |
| Jetons | Stockés **chiffrés** sur `users` (`oauthToken`, `refreshToken`), purgés automatiquement sur `invalid_grant`. | `back/src/services/UserService.ts`, `oauth-client.ts:80-115` |
| Usage Drive | Toujours **au nom d'un utilisateur staff** : `GoogleDriveService.fromTokens(user.oauthToken, …)` avec persistance du refresh. | `back/src/services/MailTemplateService.ts:121-132`, `back/src/rest/candidates/route.ts:116-133` |
| Opérations disponibles | `listFiles`, `findFolder`, `createFolder`, `listFolderFiles`, `uploadFile`, `downloadFile`, `exportFile`, `deleteFile`. | `back/src/external/google/drive.service.ts` |
| Config en base | Motif éprouvé : un document de config par région (`DriveFolderConfig`, `AbDriveConfig`), édité depuis l'UI, fallback `.env`. | `back/src/services/DriveFolderConfigService.ts`, `AbDriveConfigService.ts` |
| Upload HTTP | `multer` en mémoire avec plafond (10 Mo modèles mail, 50 Mo candidats). | `back/src/rest/mailTemplates/route.ts:20`, `back/src/rest/candidates/route.ts:18` |

**Conséquence** : les documents d'un formateur seront écrits dans le Drive **d'un compte Peda
désigné**. Le formateur n'a évidemment pas accès à ce Drive : la restitution doit passer par un
**proxy backend** (aucun partage public, aucun lien « anyone with the link »).

### 1.5 Référentiel formateurs (lot précédent)

| Élément | Constat | Référence |
|---|---|---|
| Fiche | `name`, `email` (unique, normalisé), `phone`, `comment`, `created_by`, horodatages. | `back/src/types/formateur.types.ts` |
| Journal | `formateur_history` append-only : création, diff champ par champ, notes Peda, auteur + date. | `back/src/repositories/mongo/FormateurHistoryRepository.ts` |
| API | `GET|POST /api/formateurs`, `GET|PUT /:id`, `POST /:id/notes` — rôles `AD/GESTION/PEDA`. | `back/src/rest/formateurs/route.ts` |
| Statistiques | Nombre de séances, heures planifiées, sessions, période — calculées à la volée. | `back/src/services/FormateurService.ts` |
| Fiche front | `/peda/formateurs/:id` : stats, coordonnées, sessions, historique des séances, journal + note. | `front/.../src/pages/peda/FicheFormateur.tsx` |
| Sélection en séance | `FormateurPicker` + `formateurId` dans le formulaire, déliaison si saisie manuelle. | `front/.../src/components/peda/FormateurPicker.tsx`, `SeanceFormModal.tsx` |

**Point d'appui** : la fiche est déjà l'ancre naturelle de l'identité formateur. Il ne lui manque
qu'une **signature d'accès**, des **indisponibilités**, des **documents** et un **état de
connexion**.

---

## 2. Exigences → état actuel

| # | Exigence | État | Socle existant | Manque |
|---|---|---|---|---|
| 1 | Identité formateur (accès à un espace personnel) | ⚠️ PARTIEL (lot 1) | Compte `users` `JobRole.FORMATEUR` (id 7), login mot de passe, cookies staff, refresh tokens ; espace `/formateur` + `GET /api/formateur/me` ; gestion du compte depuis la fiche Peda | Session longue dédiée côté formateur (aujourd'hui : cookies staff partagés, 15 min + refresh), cookies dédiés, journal de connexion |
| 2 | « Prochain créneau » | ⚠️ PARTIEL (lot 1) | `findByFormateur`, dates locales ; `GET /api/formateur/me` renvoie la prochaine séance (aujourd'hui inclus, fuseau du tenant) et les compteurs, affichés sur `/formateur` | Lien d'émargement depuis l'espace, vue détaillée du créneau |
| 3 | Calendrier des séances | ⚠️ PARTIEL | Séances datées ; grille mois existante côté Peda (Google) | Vue calendrier locale (pas Google), agrégation séances + indispos |
| 4 | Indisponibilités déclarées par le formateur | ❌ ABSENT | — | Collection, CRUD, UI calendrier |
| 5 | Blocage de l'affectation sur un jour indisponible | ❌ ABSENT | `resolveForSeance`, formulaire de séance | Contrôle serveur à la création **et** à la modification, retour 409, contournement Peda journalisé |
| 6 | « Mes séances » filtrable (passées / à venir) | ⚠️ PARTIEL | Liste complète des séances de la fiche | Endpoint filtré/paginé, onglets, filtres date/session, lien émargement |
| 7 | « Mes documents » sur Drive | ❌ ABSENT | `GoogleDriveService` complet, `multer` | Métadonnées, upload/download proxifiés, quotas, erreurs Drive |
| 8 | Section Peda de liaison Drive | ❌ ABSENT | Motif « config en base » (`DriveFolderConfig`) | Choix du compte de stockage, navigation des dossiers, test, alerte de reconnexion |
| 9 | Lien avec la fiche formateur Peda | ✅ FAIT (socle) | Fiche + stats + journal | Ajout des indispos, documents, accès (le bloc « accès » est livré au lot 1), prochaine séance, boutons « envoyer/révoquer l'accès » |

---

## 3. Détail par exigence

### 3.1 Identité — **écart majeur**

> ⚠️ **Section historique.** L'option A ci-dessous a été écartée le 2026-11-12 au profit de
> l'option B (voir **§3.1 bis** et la décision D1 au §6). Elle reste ici pour garder la trace de
> l'arbitrage.

Trois options ont été évaluées.

**Option A — signature d'accès portée par la fiche (recommandée).**
`formateurs.access_signature` (unique, suffixée `:region`), `access_status`
(`active` / `revoked`), `access_last_used_at`. Le Peda envoie un lien
`/formateur/acces?sig=…` ; l'ouverture échange la signature contre une session. Aucun mot de passe,
aucune ligne dans `users`, aucune fuite dans l'annuaire staff (`/api/auth/users`,
`/api/auth/directory`). Le formateur reste un **contact externe**, ce qu'il est.

**Option B — compte utilisateur avec `JobRole.FORMATEUR`.**
Réutilise intégralement `UserService`, la rotation des refresh tokens et le CSRF. Mais : mot de
passe à créer et à réinitialiser pour des intervenants occasionnels ; `users.email` devient une
seconde source de vérité face à `formateurs.email` ; il faut exclure le rôle de **toutes** les
listes `requireRoles(...)` et des écrans d'administration ; `listUsers` et `directory` exposent
mécaniquement les formateurs au reste du staff.

**Option C — prolonger le motif `external_access`.**
Séduisant (révocation déjà là), mais `external_access` est en **MySQL**, avec
`external_type ENUM('COMPANY','CANDIDATE')` et une clé étrangère vers `external_references`
(`database/mysql/mysql-init.sql:286-307`) : la table est conçue pour **une démarche** (matching,
entretien, import CV), pas pour une session personnelle permanente. Y faire entrer un formateur
imposerait d'élargir l'enum, d'inventer une référence par fiche et de rendre la table illisible.

**Recommandation : A**, avec une précision importante — le cookie d'accès guest actuel **ne suffit
pas** (15 min, pas de refresh). Il faut :

- un cookie d'accès court (`disc_at`, 15 min) contenant `{ role: FORMATEUR_GUEST, formateurId,
  signature, region }` ;
- un **cookie de session longue** (`disc_frt`, httpOnly, `path=/api/formateur`, 30 jours) dont le
  hash SHA-256 est stocké dans une collection `formateur_sessions` (`expires_at`, `revoked_at`,
  `user_agent`, `ip`, `last_seen_at`) ;
- `POST /api/formateur/auth/refresh` qui **fait tourner** ce jeton (détection de réutilisation, comme
  le fait déjà `UserService` pour le staff) ;
- `POST /api/formateur/auth/logout` et une révocation globale côté Peda (« déconnecter tous les
  appareils »).

La région ne peut pas être relue depuis l'URL (l'espace n'a pas de signature dans le chemin) : elle
doit donc être **embarquée dans le JWT** et synchronisée par le middleware, sur le modèle de
`authenticate()` (`isRegion(payload.region)`).

### 3.1 bis Identité — **conception retenue (option B, lot 1)**

Le formateur est un **compte `users` ordinaire** avec un rôle dédié, comme l'option B le proposait.
Le raisonnement qui a fait basculer D1 :

- l'exploitant veut **gérer les accès depuis la fiche** et **transmettre les identifiants** : un mot
  de passe réinitialisable en un clic est plus simple à opérer qu'un lien magique à renvoyer et à
  faire expirer ;
- le socle `UserService` (bcrypt, rotation des refresh tokens, CSRF, `authGuardRole`) est déjà audité
  et testé — l'option A aurait dupliqué cette mécanique (sessions, cookie dédié, middleware, page
  d'échange) pour un bénéfice incertain ;
- les deux objections de l'option B sont traitées explicitement : le rôle est **exclu de
  l'annuaire** (`UserService.findAll` filtre `FORMATEUR`, donc `/api/auth/users`,
  `/api/auth/directory` et l'annuaire MCP) et **aucune route staff ne l'accepte** — `authenticate()`
  ne liste que les rôles staff, `authenticateAny()` n'ouvre que `/api/auth/me`, `/api/auth/logout`
  et `/api/formateur/*` — et les **serveurs GraphQL** (`jwtContext`) comme **MCP** (`mcpAuth`,
  consentement OAuth) le refusent explicitement : leurs gardes raisonnent d'abord en permission, et
  `EMPLOYEE` y ouvrirait tout le CRM.

Mise en œuvre :

- `JobRole.FORMATEUR` (`roles.id = 7`, seedé dans `mysql-init.sql` **et** `migrations.ts`),
  permission `EMPLOYEE` ;
- compte créé depuis `POST /api/formateurs/:id/account` avec l'e-mail de la fiche (normalisé) et le
  nom scindé au premier espace (`first_name` / `last_name`) ; e-mail renommé ou mot de passe
  réinitialisé depuis la même fiche, sessions révoquées à chaque réinitialisation ;
- `formateurs.user_id` porte le lien fiche ↔ compte (index non unique, unicité tenue par le
  service) ; un compte sans fiche reçoit 403 `no_formateur`, et l'espace résout toujours la fiche
  par `req.user.id`, jamais par un identifiant reçu du client ;
- suppression d'un compte = soft delete `users` + révocation des sessions ; l'adresse reste occupée,
  donc `UserService.register` **réactive** la ligne supprimée au lieu de buter sur l'unicité ;
- suppression d'une fiche = compte désactivé, `seances.formateur_id` remis à `null` (le rattachement
  par e-mail reprend la main), journal `formateur_history` conservé, entrée `formateur_deleted`.

Reste ouvert de l'option A, à reprendre si le besoin apparaît : **cookies dédiés** (B3, un formateur
et un staff sur le même navigateur se marchent aujourd'hui dessus), journal de connexion, révocation
globale « tous les appareils » en un clic (la réinitialisation de mot de passe la réalise de fait).

### 3.2 Prochain créneau et 3.6 Mes séances

Les données existent déjà (`findByFormateur`), il manque la projection et les filtres. Deux points
de conception :

- **Pagination obligatoire** : un formateur à temps plein sur plusieurs années dépasse la centaine de
  séances ; la fiche Peda charge tout, l'espace formateur ne doit pas.
- **« À venir » = aujourd'hui inclus**, calculé dans le fuseau du tenant (`localDate(new Date(),
  tenantTimezone())`), pas dans celui du navigateur : un formateur itinérant peut consulter depuis
  un autre fuseau.

Le lien d'émargement est **calculé** dans le DTO de chaque séance (`buildSeanceToken`) et non stocké :
un renvoi d'invitation qui tourne `token_secret` ne laisse donc jamais de lien mort dans l'espace.
Après J+7, le lien reste consultable en lecture seule — comportement déjà géré par la page publique.

### 3.3 Calendrier

Le calendrier Peda existant (`PedaCalendrier.tsx`) est **adossé à Google Calendar** (OAuth du Peda) :
il n'est pas réutilisable pour un formateur qui n'a pas de compte Google autorisé. Il faut une vue
**locale**, alimentée par deux sources :

1. les séances du formateur (`date`, `start_time`, `end_time`, statut de validation) ;
2. ses indisponibilités (`from_date` → `to_date`).

Les utilitaires de grille (lundi = 0, `ymd`, `eventDayKey`, navigation mensuelle) de
`PedaCalendrier.tsx` sont génériques : les extraire dans `src/utils/calendar.ts` évite un doublon de
~80 lignes. C'est un refactor **sans changement de comportement** pour le Peda.

### 3.4 Indisponibilités et 3.5 blocage

Aucune notion n'existe (vérifié : aucune occurrence de disponibilité hors candidats).

Modèle proposé — `formateur_availability` : `_id`, `formateur_id`, `from_date`, `to_date`
(`YYYY-MM-DD`, une journée = même valeur), `reason` (≤ 200 car., facultatif), `created_by`
(`formateur` ou `users.id`), `created_at`. Les plages sont **incluses** et peuvent se chevaucher ;
la lecture fusionne.

**Le blocage doit être serveur.** Un contrôle uniquement dans le formulaire serait contourné par un
appel direct ou par une modification ultérieure. Point d'insertion : `EmargementService.create` et
`update`, juste après `resolveForSeance`, via
`FormateurService.assertAvailable(formateurId, date)` → `409 { code: 'unavailable', date }`.

Trois pièges à traiter explicitement :

- **Modification d'une séance existante** : si seule l'heure change, ou si le formateur déclare *a
  posteriori* une indisponibilité sur une séance déjà planifiée, l'enregistrement ne doit pas être
  bloqué. Le contrôle ne s'applique que si la **date** ou le **formateur** change.
- **Séance antérieure à l'annuaire** (pas de `formateur_id`) : pas de contrôle possible au premier
  enregistrement — la fiche est créée à ce moment-là, et l'indisponibilité ne peut pas exister avant.
- **Contournement Peda** : une séance peut devoir être planifiée malgré tout (urgence, remplacement).
  Recommandation : autoriser un `force: true` explicite, **journalisé** dans `formateur_history`
  (action `seance_forced` avec la date et l'auteur), plutôt qu'un blocage rigide qui pousserait à
  supprimer l'indisponibilité pour contourner.

Côté formulaire, le `FormateurPicker` reçoit déjà le contexte de la séance ; il doit connaître la
**date choisie** pour signaler « indisponible le 12/11 » avant l'envoi, et non seulement après le 409.

### 3.7 Mes documents

Rien n'existe : la route `/api/formateurs` n'a ni `multer`, ni stockage.

Chaîne proposée :

1. `POST /api/formateur/documents` (guest formateur, `multer` mémoire, 20 Mo, liste blanche MIME) ;
2. résolution du compte de stockage (`formateur_drive_config.owner_user_id`) et de sa racine ;
3. `findFolder` / `createFolder` pour `Formateurs/<Nom> (<email>)`, puis mise en cache de
   `drive_folder_id` sur la fiche ;
4. `uploadFile` avec des jetons **du compte Peda** ;
5. métadonnées en base (`formateur_documents` : `name`, `mime_type`, `size`, `drive_file_id`,
   `drive_folder_id`, `uploaded_by`, `created_at`) — indispensable pour lister sans interroger Drive
   à chaque affichage et pour l'audit ;
6. téléchargement **proxifié** par le backend (`GET /documents/:id/download`), jamais par lien
   partagé.

**Pourquoi les métadonnées en base et pas un simple listing Drive ?** Parce que Drive ne porte ni
l'auteur applicatif, ni le formateur rattaché de façon fiable, et parce qu'un listing par affichage
coûte un appel API (latence, quota).

**Pannes à prévoir** : jeton Google du propriétaire mort (`invalid_grant` → jetons purgés
automatiquement, `oauth-client.ts:80-115`), dossier supprimé, quota Drive, conflit de nom. Chaque cas
doit produire un message actionnable côté formateur (« dépôt indisponible, prévenez le service
pédagogique ») et une **alerte visible côté Peda**, sinon le formateur dépose dans le vide.

### 3.8 Section Peda de liaison Drive

Elle n'existe pas. Le motif à copier est `DriveFolderConfigService` / `AbDriveConfigService` : un
document de configuration par région, édité depuis l'UI, avec un fallback `.env` optionnel.

Contenu minimal :

- **compte de stockage** : un membre du staff dont le Google est connecté (liste restreinte aux
  comptes `googleConnected === true`) — recommandation : une **liste ordonnée** de propriétaires
  avec bascule automatique sur le premier connecté, plutôt qu'un seul identifiant, pour éviter
  qu'un départ ou une révocation ne coupe le service ;
- **dossier racine** : identifiant saisi ou choisi via un navigateur de dossiers
  (`listFolderFiles` filtré sur `application/vnd.google-apps.folder`) exécuté avec les jetons du
  compte choisi ;
- **test de bout en bout** : créer un dossier d'essai, y écrire un fichier, le supprimer ;
- **état** : connecté / non connecté / erreur, avec bouton de reconnexion.

L'emplacement logique est la navigation Peda (`/peda/parametres/drive-formateurs`), à côté des
modèles de mail — la barre latérale Peda n'a aujourd'hui aucune entrée « Paramètres » :
`PedaLayout.tsx:63-71`.

### 3.9 Lien avec la fiche formateur Peda

C'est la partie la moins coûteuse : la fiche existe. À ajouter, sans donner au Peda un accès au
compte du formateur (pas d'usurpation d'identité) :

- **prochaine séance** (déjà calculable depuis `stats`/`seances`) ;
- **indisponibilités à venir** (avec possibilité d'en créer une pour le compte du formateur — un
  appel téléphonique arrive souvent avant la déclaration) ;
- **documents** : liste, taille, déposant, date, téléchargement ;
- **accès** : état (`jamais ouvert`, `dernière connexion le …`), boutons « envoyer / renvoyer le lien
  d'accès », « révoquer ».

Tout cela alimente `formateur_history` (déjà append-only), ce qui rend l'espace formateur auditable
sans nouveau mécanisme de journal.

---

## 4. Écarts transverses (à traiter avant le premier lot)

| # | Écart | Impact | Référence |
|---|---|---|---|
| B1 | Aucun rôle ni identité formateur | Bloque tout le reste | `types/user.types.ts:1-17` |
| B2 | Session guest de 15 min sans refresh | Un espace personnel serait inutilisable | `cookies.ts:31-46`, `env.ts:176` |
| B3 | Cookie `disc_at` partagé staff / guest | Un Peda qui ouvre l'espace formateur perd sa session staff (et inversement) | `cookies.ts:5-46` |
| B4 | `sessionGuard` ne rafraîchit que `/api/auth/refresh` | Un 401 formateur déclencherait le mauvais chemin (refresh staff), puis un logout silencieux | `front/.../src/lib/sessionGuard.ts:66-77` |
| B5 | `AuthBootstrap` interroge `/api/auth/me` au montage | Réponse 403 pour un guest : sans conséquence (erreur avalée) mais à ne pas laisser évoluer | `AuthBootstrap.tsx:15-19` |
| B6 | Aucune notion d'indisponibilité | Exigence 4 et 5 entièrement à construire | — |
| B7 | Drive uniquement au nom d'un staff | Stockage documentaire dépendant d'un compte humain | `MailTemplateService.ts:121-132` |
| B8 | Une fiche = une région | Un formateur intervenant dans les deux tenants aurait deux espaces | `db/mongo/tenant.ts:59-65` |

**Sur B3/B4**, deux stratégies :

- *cookies partagés* : le moins de code, mais un Peda ne peut pas prévisualiser l'espace sans perdre
  sa session — et un formateur qui se connecte au portail staff écrase son cookie ;
- *cookies dédiés* (`disc_fat` / `disc_frt` / `disc_fcsrf`) : une dizaine de lignes de plus dans le
  middleware et dans `lib/csrf.ts`, mais **isolation totale**. Recommandé.

---

## 5. Architecture proposée

### 5.1 Identité et sessions

> ⚠️ **Non retenu.** Décrit l'option A ; la conception livrée est celle du **§3.1 bis** (compte
> `users` + `JobRole.FORMATEUR`, cookies staff existants) et du **§11**.

```
Peda : POST /api/formateurs/:id/access        → génère/renouvelle access_signature, envoie l'e-mail
Formateur : GET  /formateur/acces?sig=…       → page d'atterrissage (route publique)
            POST /api/formateur/auth/open     → vérifie la fiche, pose disc_fat (15 min) + disc_frt (30 j)
            POST /api/formateur/auth/refresh  → rotation du jeton de session, nouveau disc_fat
            POST /api/formateur/auth/logout   → révoque la session courante
Toutes les autres routes : requireFormateurGuest (rôle FORMATEUR_GUEST + session non révoquée)
```

- JWT : `{ role: 'FORMATEUR_GUEST', permission: 'GUEST', formateurId, signature, region }`.
- Collection `formateur_sessions` : `_id`, `formateur_id`, `token_hash` (SHA-256), `created_at`,
  `last_seen_at`, `expires_at`, `revoked_at`, `ip`, `user_agent` (tronqués comme ailleurs).
- E-mail d'accès : modèle système dédié, sur le modèle de `emargementInviteTemplate` +
  `sendSystemEmail` / `withNoReply`.
- Révocation : `access_status = 'revoked'` **et** `revoked_at` sur toutes les sessions ; le Peda peut
  renvoyer un lien (nouvelle signature) sans toucher aux séances.

### 5.2 Modèle de données

| Collection | Champs | Index |
|---|---|---|
| `formateurs` (existant, enrichi) | `+ access_signature` (unique), `access_status`, `access_last_used_at`, `drive_folder_id` | `access_signature` unique |
| `formateur_sessions` (nouveau) | `formateur_id`, `token_hash`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `ip`, `user_agent` | `{formateur_id, expires_at}`, `{token_hash}` unique |
| `formateur_availability` (nouveau) | `formateur_id`, `from_date`, `to_date`, `reason`, `created_by`, `created_at` | `{formateur_id, from_date}` |
| `formateur_documents` (nouveau) | `formateur_id`, `name`, `mime_type`, `size`, `drive_file_id`, `drive_folder_id`, `uploaded_by`, `uploaded_by_user_id`, `created_at`, `deleted_at` | `{formateur_id, created_at}` |
| `formateur_drive_config` (nouveau) | `owner_user_ids[]`, `root_folder_id`, `updated_at`, `updated_by` | document unique par région |
| `formateur_access_log` (nouveau, optionnel lot 6) | `formateur_id`, `action` (`open`, `refresh`, `logout`, `upload`, `download`), `ip`, `user_agent`, `at` | `{formateur_id, at}` |

Les cinq collections doivent être déclarées dans `db/mongo/schemas/` **et** enregistrées dans
`getModels()` (`tenant.ts`), comme les lots précédents.

### 5.3 API

| Méthode | Route | Garde | Rôle |
|---|---|---|---|
| POST | `/api/formateur/auth/open` | rate-limit + région | Échange la signature contre une session |
| POST | `/api/formateur/auth/refresh` | `disc_frt` | Rotation de session |
| POST | `/api/formateur/auth/logout` | `requireFormateurGuest` | Ferme la session |
| GET | `/api/formateur/me` | `requireFormateurGuest` | Fiche, compteurs, fuseau, état d'accès |
| GET | `/api/formateur/dashboard` | idem | Prochaine séance + compteurs |
| GET | `/api/formateur/seances?scope=past\|upcoming&from&to&sessionId&cursor` | idem | Liste paginée |
| GET | `/api/formateur/calendar?from&to` | idem | Séances + indisponibilités |
| GET/POST/DELETE | `/api/formateur/availability` | idem | Déclaration d'indisponibilité |
| GET/POST | `/api/formateur/documents` | idem | Liste / dépôt |
| GET | `/api/formateur/documents/:id/download` | idem | Téléchargement proxifié |
| POST | `/api/formateurs/:id/access` | staff | Envoi / renvoi du lien |
| POST | `/api/formateurs/:id/access/revoke` | staff | Révocation |
| GET/PUT | `/api/peda/formateur-drive` | staff | Config Drive |
| GET | `/api/peda/formateur-drive/folders?parent=` | staff | Navigation des dossiers |

Les filtres et la pagination reprennent `services/pagination.ts` (déjà utilisé ailleurs) plutôt qu'un
`skip/limit` maison.

### 5.4 Front

```
/formateur/acces            → atterrissage du lien (publique, hors layout)
/formateur                  → « Prochain créneau » (accueil)
/formateur/calendrier       → calendrier + indisponibilités
/formateur/seances          → onglets Passées / À venir + filtres
/formateur/documents        → Mes documents
```

- `FormateurLayout` dédié (barre latérale légère ou navigation par onglets, mobile-first).
- **Mobile-first impératif** : les formateurs consultent leur planning et déposent des documents
  depuis un téléphone. La page d'émargement publique est déjà conçue ainsi — s'aligner dessus.
- Aucun `ProtectedRoute` : un `FormateurSessionProvider` appelle `/api/formateur/me`, et redirige
  vers `/formateur/acces` si la session est absente.
- Le rafraîchissement silencieux doit être **branché dans `sessionGuard`** pour les URLs
  `/api/formateur/*` (B4), sans toucher au chemin staff.
- Composants réutilisables : `Card`, `Badge`, `EmptyState`, `Spinner`, `PageHeader` existent déjà
  (`components/ui/index.ts`).

### 5.5 Drive

```
Formateur ──upload──▶ POST /api/formateur/documents
                       └─▶ FormateurDocumentService
                            ├─ formateur_drive_config (owner, root)
                            ├─ GoogleDriveService.fromTokens(ownerTokens)   ← compte Peda
                            ├─ findFolder "Formateurs/<Nom> (<email>)"  ──▶ cache fiche
                            ├─ uploadFile(...)
                            └─ formateur_documents (métadonnées)
Formateur ◀─download── GET /api/formateur/documents/:id/download  ← flux proxifié
```

- **Aucun partage public.** Le fichier n'est jamais rendu accessible par lien : la seule porte est le
  backend, authentifié par la session formateur.
- **Liste blanche MIME** + taille plafonnée (20 Mo par défaut) + nom de fichier assaini.
- **Bascule de propriétaire** si le premier compte est déconnecté (403/`invalid_grant`).
- **Quota** : plafonner le nombre de documents par formateur (ex. 200) ou le volume (ex. 500 Mo),
  sinon un dépôt accidentel remplit le Drive partagé.

### 5.6 Blocage à la création / modification de séance

```
EmargementService.create/update
  └─ FormateurService.resolveForSeance(...)          (existant)
       └─ FormateurService.assertAvailable(id, date) (nouveau)
            ├─ plage trouvée + !force → 409 { code: 'unavailable', dates }
            └─ plage trouvée + force  → journalise seance_forced puis continue
```

Le formulaire Peda reçoit la liste des indisponibilités **à venir** dans `GET /api/formateurs`
(ou via `GET /api/formateurs?date=…`), ce qui permet un retour immédiat au moment du choix, sans
attendre le 409.

### 5.7 Fiche formateur enrichie

Nouvelle organisation de `/peda/formateurs/:id` :

| Bloc | Contenu |
|---|---|
| En-tête | Nom, coordonnées, état d'accès (« jamais ouvert » / « dernière connexion »), actions accès |
| Résumé | Stats existantes + **prochaine séance** |
| Indisponibilités | Liste à venir, création pour le compte du formateur, suppression |
| Documents | Liste (nom, taille, déposant, date), téléchargement, suppression motivée |
| Historique des séances | Existant |
| Journal | Existant, enrichi des actions d'accès et de dépôt |

---

## 6. Décisions à arbitrer

> **Acté le 2026-11-06** : **D1 = signature sur la fiche** (pas de compte `users`) et **D3 = blocage
> + override Peda journalisé**. Ces deux décisions ferment le chemin critique de L1 et L3.
>
> **Révision du 2026-11-12** : **D1 est inversée → option B (compte `users` avec
> `JobRole.FORMATEUR`)**. Motifs : gestion des accès depuis la fiche Peda, identifiants transmis et
> réinitialisés par l'exploitant, réutilisation du socle d'authentification existant ; les deux
> écarts redoutés (annuaire staff, routes staff) sont fermés par `UserService.findAll` et par
> `authenticate`/`authenticateAny`. D3 reste inchangée.

| # | Question | Options | Recommandation |
|---|---|---|---|
| D1 | Identité du formateur | A. signature sur la fiche · B. compte `users` avec `JobRole.FORMATEUR` | **✅ B acté le 2026-11-12** (§3.1 bis, §11) — A abandonnée |
| D2 | Cookies | partagés `disc_at` · dédiés `disc_fat` | **dédiés** (isolation staff/guest) |
| D3 | Indisponibilité : blocage ou avertissement | blocage strict · avertissement + override journalisé | **✅ blocage + override Peda journalisé** |
| D4 | Granularité | journée · demi-journée | **journée** (conforme à la demande) ; demi-journée en option ultérieure |
| D5 | Documents : accès | lien de partage Drive · proxy backend | **proxy** (aucune donnée exposée par URL) |
| D6 | Propriétaire de stockage | un Peda unique · liste ordonnée avec bascule | **liste avec bascule** (§3.8) |
| D7 | Suppression d'un document | interdite · autorisée (soft delete) | **autorisée** par le déposant et par le Peda, en soft delete |
| D8 | Vue inter-régions | une fiche = une région · agrégation multi-tenant | **une région** (limite assumée, documentée) |
| D9 | Notifications | aucune · e-mail à chaque affectation · résumé hebdomadaire | **aucune en v1**, à cadrer ensuite |
| D10 | Prévisualisation Peda de l'espace | usurpation de session · lecture seule dans la fiche | **lecture seule dans la fiche** |

---

## 7. Risques et parades

| # | Risque | Probabilité | Impact | Parade |
|---|---|---|---|---|
| R1 | Jeton d'accès formateur partagé ou transféré (lien e-mail) | moyenne | accès aux documents d'un tiers | session liée à un appareil, révocation, journal de connexion, expiration 30 j |
| R2 | Dépôt de documents contenant des données d'alternants | **élevée** | RGPD (données de tiers, hors consentement) | mention explicite dans l'UI, registre RGPD, accès restreint, durée de conservation |
| R3 | Drive propriétaire déconnecté (départ, mot de passe changé) | moyenne | dépôt impossible | liste d'owners + bascule + alerte Peda + test de config |
| R4 | Indisponibilités ignorées (contournement) | moyenne | planification erronée | contrôle serveur + journal `seance_forced` |
| R5 | Confusion de sessions dans un navigateur partagé (salle de formation) | moyenne | fuite d'accès | cookies dédiés + bouton « se terminer » visible + expiration courte de l'accès |
| R6 | Volume documentaire non borné | faible | quota Drive | plafond par formateur + taille max par fichier |
| R7 | Émargement ouvert depuis « Mes séances » après J+7 | **certaine** | incompréhension | libellé explicite « consultation seule » + badge d'état |
| R8 | Lien d'accès considéré comme un mot de passe | moyenne | perte de contrôle | e-mail explicatif, révocation en un clic, journal d'ouverture |

---

## 8. Plan de lots

| Lot | Contenu | Charge indicative | Dépend de |
|---|---|---|---|
| **L1 — Identité et coquille** | Signature d'accès, `formateur_sessions`, e-mail, `auth/open|refresh|logout`, middleware, cookies dédiés, `FormateurLayout`, `/formateur` + `/me`, bloc « accès » sur la fiche Peda | 4–6 j | — |
| **L2 — Prochain créneau et mes séances** | DTO + endpoints paginés, onglets passées/à venir, filtres, liens d'émargement calculés | 2–3 j | L1 |
| **L3 — Calendrier et indisponibilités** | Collection, CRUD, vue calendrier, extraction des utilitaires de grille, blocage serveur + override journalisé, picker informé | 4–5 j | L1, L2 |
| **L4 — Config Drive Peda** | Collection de config, page `/peda/parametres/drive-formateurs`, navigation de dossiers, test, alerte | 3–4 j | L1 |
| **L5 — Mes documents** | Métadonnées, upload/download proxifiés, quotas, MIME, gestion des pannes Drive | 4–6 j | L4 |
| **L6 — Finitions et conformité** | Fiche Peda enrichie, journal d'accès, révocation globale, RGPD, `E2E.md`, `CHANGELOG` | 3–4 j | L1–L5 |

Chemin critique : **L1 → L3** (l'indisponibilité n'a de sens qu'avec une identité) et
**L4 → L5** (pas de documents sans destination). L2 peut avancer en parallèle de L4.

> **Avancement.** **L1 est livré** sous une forme réduite (compte `users` au lieu de la signature
> d'accès, cookies staff au lieu de cookies dédiés) : voir le journal des lots au **§11**. Les lots
> L2 à L6 restent à faire.

---

## 9. Impacts documentation, tests et conventions

| Document | Impact |
|---|---|
| `CHANGELOG.md` + copie front (byte-identique) | nouvelle section à chaque lot |
| `database/mongodb/mongo-schema.md` | 4 à 5 collections + champs ajoutés à `formateurs` |
| `back/README.md` | routes, compteurs de modules/schémas/repositories/services |
| `front/disciplina-front/README.md` | routes `/formateur/*` et `/peda/parametres/*` |
| `RGPD.md` | nouveau traitement : accès (IP, user-agent, horodatage), indisponibilités, documents (données de tiers, conservation, hébergement Drive) |
| `E2E.md` | nouvelle section « espace formateur » + lignes de régression |
| `HOWTODEPLOY.md` | uniquement si une variable d'environnement est ajoutée (TTL de session, fallback Drive) — règle du dépôt |
| `AUDIT_EMARGEMENT.md` | rien à changer ; le sujet identité (§3.4) reste ouvert |
| `registre-mcp.md` | aucun impact (pas d'exposition MCP prévue) |

**Tests** (conventions `back/HOWTOTEST.md`) : tests composants sur le vrai serveur pour
`auth/open|refresh` (y compris jeton révoqué et région), blocage d'affectation sur indisponibilité
(création **et** modification), téléchargement proxifié. La frontière de mock est `src/external/*` :
`GoogleDriveService` peut être espionné, les services/repos non. Un test existant devra être adapté :
le parcours de création de séance refuse désormais un formateur indisponible.

**Conventions à respecter** : `logger` (pas `console.*`), pas de `zod` hors `src/mcp/`, exports
nommés, types domaine Mongo en snake_case, colonnes MySQL en double (`mysql-init.sql` +
`REQUIRED_COLUMNS`) — ici aucune nouvelle colonne MySQL n'est nécessaire.

---

## 10. Hors périmètre

- **Comptes formateurs multi-régions** (D8) et facturation.
- **Notifications push / e-mail automatiques** au formateur (D9).
- **Gestion des remplacements** (proposer un autre formateur disponible en cas de conflit).
- **Signature électronique des interventions** (contrats, conventions).
- **Application mobile native** : l'espace est web, responsive.
- **MFA** pour les formateurs : improbable à court terme ; le mot de passe de 12 caractères en tient
  lieu.
- **Exposition MCP** des documents ou indisponibilités : aucun besoin exprimé, et toute exposition
  imposerait le passage par `pedaExposure.ts`.

---

## 11. Journal des lots

### Lot 1 — Identité, coquille et accueil (#1185, livré le 2026-11-12)

**Périmètre livré** — une version réduite de L1 : l'identité repose sur un compte `users` (D1
inversée) et la coquille se limite à un accueil, sans calendrier, documents ni indisponibilités.

| Domaine | Livré |
|---|---|
| Base | `roles` id 7 `FORMATEUR` (`mysql-init.sql` + `INSERT IGNORE` dans `migrations.ts`) ; `formateurs.user_id` (index non unique) |
| Backend auth | `JobRole.FORMATEUR` ; `authenticateWith` refactoré, `authenticate` reste staff-only, `authenticateAny` pour `/api/auth/me` et `/api/auth/logout` ; refus explicite du rôle dans `jwtContext` (GraphQL) et `mcpAuth` + consentement OAuth (MCP), dont les gardes raisonnent d'abord en permission |
| Backend comptes | `UserService.register` (réactivation d'une ligne soft-deleted sur le même e-mail), `revokeAllSessions`, `passwordPolicyViolations` exporté, `findAll` exclut les formateurs |
| Backend fiche | `FormateurService.createAccount` / `resetAccountPassword` / `deleteAccount` / `remove`, synchro e-mail + `first_name`/`last_name`, `dashboardForUser` ; `FormateurRepository.findByUserId`/`delete`, `SeanceRepository.unlinkFormateur` |
| Backend routes | `DELETE /api/formateurs/:id`, `POST · PUT · DELETE /api/formateurs/:id/account`, `GET /api/formateur/me` (`authenticateAny` + `requireRoles('FORMATEUR')`) |
| Journal fiche | actions `formateur_deleted`, `account_created`, `account_password_reset`, `account_deleted` |
| Front | `UserRole.FORMATEUR`, redirection login, `ProtectedRoute` (blocage dur + repli), `FormateurLayout`, `pages/formateur/DashboardFormateur.tsx`, `api/formateurApp.ts`, arbre `/formateur`, carte d'accès + zone de suppression sur `FicheFormateur` |
| Tests | `rest/formateurs/__tests__/formateurAccount.test.ts` (8 tests : création, mot de passe faible, unicité, synchro e-mail/nom, exclusion de l'annuaire, cloisonnement, tableau de bord, cycle de vie) |
| Docs | `CHANGELOG.md` + copie front, `mongo-schema.md`, `RGPD.md`, `E2E.md` §3.14 sexies, `back/README.md`, `front/disciplina-front/README.md` |

**Décisions prises pendant le lot**

- Le mot de passe est **saisi par le Peda** et transmis hors application (pas d'e-mail d'invitation
  dans ce lot) ; la réinitialisation révoque toutes les sessions du compte.
- `formateurs.user_id` n'est **pas** unique en base : Mongo n'accepte qu'un seul `null` par index
  unique non sparse. L'unicité est tenue par `createAccount` (409 `account_exists`).
- La suppression d'une fiche **conserve** `formateur_history` et **délie** les séances ; sans cela
  elles garderaient un `formateur_id` orphelin invisible des compteurs.
- Les formateurs sont **exclus de `UserService.findAll`** plutôt que filtrés dans chaque appelant :
  `/api/auth/users`, `/api/auth/directory` et l'annuaire MCP se corrigent d'un coup.
- Le rôle est **refusé explicitement** par `jwtContext` et par `mcpAuth` (et par le consentement
  OAuth MCP) : ces gardes accordent l'accès sur la permission avant le rôle, si bien qu'un compte
  `EMPLOYEE` aurait lu tout le CRM malgré son rôle. Le mot de passe d'un formateur ne peut pas non
  plus servir à accorder un consentement MCP.
- Le retour à la vie d'un compte supprimé est **limité aux comptes formateurs** : l'admin qui crée
  un utilisateur sur une adresse déjà portée par un ancien collaborateur supprimé garde l'ancien
  comportement (409), pour ne pas changer silencieusement l'identité et le rôle sous le même id.

**Reste à faire (L1 complet et suites)**

- Cookies dédiés au formateur (B3) : aujourd'hui un formateur et un staff sur le même navigateur se
  déconnectent mutuellement ; l'audit recommande `disc_fat`/`disc_frt`/`disc_fcsrf`.
- Journal de connexion formateur et bouton « déconnecter tous les appareils » explicite (la
  réinitialisation de mot de passe le fait déjà, sans le dire).
- L2 (mes séances paginées), L3 (calendrier + indisponibilités + blocage), L4/L5 (Drive + documents),
  L6 (finitions).

---

## Annexe — Fichiers à créer ou modifier

> **État au 2026-11-12.** Le lot 1 n'a **pas** créé `FormateurAppService`, `formateurSession.schema`
> ni `formateurAccessTemplate` : l'identité passe par `UserService` (voir §11). Les fichiers de la
> liste restent la cible des lots L2 à L5.

**Créer**

```
back/src/types/formateurApp.types.ts
back/src/db/mongo/schemas/formateurSession.schema.ts
back/src/db/mongo/schemas/formateurAvailability.schema.ts
back/src/db/mongo/schemas/formateurDocument.schema.ts
back/src/db/mongo/schemas/formateurDriveConfig.schema.ts
back/src/repositories/mongo/FormateurSessionRepository.ts
back/src/repositories/mongo/FormateurAvailabilityRepository.ts
back/src/repositories/mongo/FormateurDocumentRepository.ts
back/src/repositories/mongo/FormateurDriveConfigRepository.ts
back/src/services/FormateurAppService.ts
back/src/services/FormateurDocumentService.ts
back/src/services/FormateurDriveConfigService.ts
back/src/services/formateurAccessTemplate.ts
back/src/rest/formateur/route.ts
back/src/rest/formateur/controller.ts
back/src/rest/formateur/middleware.ts        (requireFormateurGuest)
back/src/rest/formateur/__tests__/…test.ts
back/src/rest/peda/formateurDrive.route.ts / controller.ts
front/disciplina-front/src/pages/formateur/{Accueil,Calendrier,Seances,Documents}.tsx
front/disciplina-front/src/pages/formateur/Acces.tsx
front/disciplina-front/src/components/layout/FormateurLayout.tsx
front/disciplina-front/src/components/formateur/…
front/disciplina-front/src/api/formateurApp.ts
front/disciplina-front/src/types/formateurApp.ts
front/disciplina-front/src/utils/calendar.ts        (extrait de PedaCalendrier)
front/disciplina-front/src/pages/peda/DriveFormateurs.tsx
```

**Modifier**

```
back/src/types/formateur.types.ts               (+ access, drive_folder_id)
back/src/types/emargement.types.ts              (+ force sur CreateSeanceInput)
back/src/db/mongo/tenant.ts                     (+ modèles)
back/src/services/FormateurService.ts           (+ assertAvailable, access, documents dans le DTO)
back/src/services/EmargementService.ts          (+ contrôle d'indisponibilité)
back/src/rest/formateurs/route.ts               (+ access)
back/src/rest/middleware/cookies.ts             (+ cookies dédiés) / tokenAuth.ts (+ rôle)
back/src/rest/external/…                        (réutilisation de la résolution de région)
back/src/index.ts                               (+ routeur)
front/src/router/index.tsx                      (+ arbre /formateur)
front/src/lib/sessionGuard.ts                   (+ refresh formateur)
front/src/lib/csrf.ts                           (+ cookie CSRF dédié si D2 = cookies dédiés)
front/src/pages/peda/FicheFormateur.tsx         (+ blocs)
front/src/components/peda/PedaCalendrier.tsx    (imports depuis utils/calendar)
front/src/components/peda/FormateurPicker.tsx   (+ indisponibilités)
front/src/components/layout/PedaLayout.tsx      (+ Paramètres / Drive formateurs)
```
