# BACKLOG

Document de référence unique : backlog métier du mois (statuts **vérifiés dans le code**) + chantiers techniques EPITECH découpés en tickets.

- **Partie 1** — Backlog mensuel, statuts re-vérifiés avec preuves `fichier:ligne`
- **Partie 2** — Reliquat réellement à faire (`REL-*`)
- **Partie 3** — Chantiers EPITECH (`DB-*`, `API-*`, `FE-*`, `OPS-*`)
- **Partie 4** — Chantiers hors énoncé, issus de l'audit du dépôt (`RGPD-*`, `DOC-*`)
- **Partie 5** — Séquencement suggéré

Légende statut vérifié : **OK** = implémenté et branché · **PARTIEL** = une partie de la chaîne existe, le reste manque · **KO** = absent.
Tailles : XS < 1 h · S ≈ ½ j · M ≈ 1-3 j · L > 3 j.

---

## Partie 1 — Backlog mensuel (statuts vérifiés)

### 1.1 Commerciaux

| Tâche | Annoncé | Vérifié | Preuve |
|---|---|---|---|
| Modifier un AB après sa création | OK | OK | — |
| Notification arrêt de recrutement / modification de champ | OK | OK | — |
| Trier les relances par date, envoi direct des mails, relance massive | OK | OK | `front/disciplina-front/src/pages/commercial/RelanceCommercial.tsx:129` (tri), `:257` (mail), `:179` (bulk → `/api/relance/company/bulk`) |
| → action « Relance effectuée » | KO | **PARTIEL** | Backend complet : `back/src/rest/relance/controller.ts:105` (`completePhoneRelance`, note obligatoire), `back/src/services/CompaniesService.ts:181` (`clearRelance`), table `relance_history` (`database/mysql/mysql-init.sql:308`). Front **orphelin** : `front/.../src/api/relance.ts:54` et `features/portefeuille/components/PhoneRelanceModal.tsx` ne sont importés nulle part. → **REL-1** |
| Intitulé de métier ≠ intitulé de formation | OK | OK | — |
| Mise à jour des informations de contact en page 5 | OK | OK | — |
| Dossier regroupant l'ensemble des AB | OK | OK | — |
| Voice Over / suivi concret des appels | KO | **KO** | Aucune dépendance télépho­nie dans `back/package.json` ; aucun hit `twilio|ringover|aircall|voip|transcription`. Seul existant : `relance_history.channel = PHONE` + `note` texte libre. → **REL-7** |
| Logo Disciplina mal affiché sur les AB | OK | OK | — |
| AB en brouillon non modifiables | OK | OK | — |
| Trace d'envoi de l'AB | OK | OK | — |
| Mail modifiable de l'AB | OK | OK | — |
| Transfert de propriété d'entreprise | non marqué | **OK en unitaire** | `back/src/graphql/company/resolvers.ts:79` (`input.userID → row.user_id`), mutation `updateCompany` (`typeDefs.ts:255`), UI « Propriétaire du contact » `front/.../features/portefeuille/components/CreateEditModal.tsx:404-423`. **Absent** : transfert en masse (réattribution du portefeuille d'un commercial sortant) et audit du changement de propriétaire. |

### 1.2 RH — Dashboard

| Tâche | Annoncé | Vérifié | Preuve |
|---|---|---|---|
| Vue par zone géographique (NORD, OUEST, SUD) | OK | OK | — |
| Accès réservé au responsable de service | OK | OK | — |
| Filtrer par RH pour une vision détaillée | OK | OK | `front/.../features/kpi/components/RhKpiPanel.tsx:274-322` (table par RH + lien vers liste filtrée) |
| KPI : nombre d'entretiens, candidats rencontrés, contrats | KO | **OK** | `RhKpiPanel.tsx:24-32` — cartes « Entretiens placés », « À venir », « Venus », « Pas venus », « Immersions », « Contrats », « Ruptures ». Table `rh_kpi` (`back/src/db/mysql/migrations.ts:91`, `mysql-init.sql:331`), agrégation `back/src/services/RhKpiService.ts`, incréments dans `back/src/rest/calendar/controller.ts:325-346` et `back/src/graphql/candidate/resolver.ts:268-337`. *Nuance* : « candidats rencontrés » s'appelle « Venus » (`interviews_attended`) — écart de vocabulaire, pas de fonctionnalité. |
| Clarté des informations du tableau de bord | OK | OK | — |
| Nom du RH ayant réalisé l'entretien sur les AB apprentis | OK | OK | `synthesis.interviewed_by` |

### 1.3 RH — Candidats

| Tâche | Annoncé | Vérifié | Preuve |
|---|---|---|---|
| Filtre titres professionnels à choix multiple | OK | **OK mais buggé** | UI présente (`front/.../pages/rh/ListeCandidats.tsx:422-430`), mais la requête Mongo ne matche que le TP principal → **REL-3** |
| Pagination : afficher le nombre total d'entrées | KO | **KO** | `CandidateConnection { edges, pageInfo }` sans `totalCount` (`back/src/graphql/candidate/typeDefs.ts:447-450`), `PageInfo` sans total (`back/src/graphql/common.typeDefs.ts:27-32`), aucun `countDocuments` dans `CandidateRepository.findPage`. Le front affiche `localCandidates.length` = taille de la page courante (`ListeCandidats.tsx:326`, `PAGE_SIZE = 20` l.75) → libellé « X candidats trouvés » trompeur. → **REL-2** |
| Modifier le statut candidat depuis la liste | KO | **OK** (peu découvrable) | `<select>` superposé au badge de statut de chaque carte : `ListeCandidats.tsx:571-586`, `handleUpdateStatus:213` avec update optimiste + rollback (`:231`), modales dédiées IMMERSION (`:239`) et INDISPONIBLE (`:257`). Le select est en `opacity-0` sans chevron → invisible, d'où le ressenti « pas fait ». → **REL-6** |
| Afficher plus d'informations sur la fiche candidat | KO | **OK de fait** | `front/.../pages/rh/FicheCandidat.tsx` (1939 lignes, 11 sections : Identité & Contact, Formation & Parcours, Profil & Compétences, Projets professionnels, Évaluation, Expériences, Synthèse, Suivi France Travail / Mission Locale, Projet professionnel & Recherche, Contact d'urgence, Dossier Drive) + placement courant, historique, actions rapides. **Bloqué** : demander à l'équipe RH la liste précise des champs manquants, sinon rien à implémenter. |
| Sauvegarde automatique des données saisies (AB candidats) | OK | OK | — |
| Problème de filtre sur les fiches candidat (Jessica) | KO | **KO — diagnostiqué** | 2 bugs confirmés + 1 facteur aggravant, cf. **REL-3**, **REL-4**, et la persistance sessionStorage/URL (`front/.../hooks/usePersistedListView.ts:54-71`) qui restaure des filtres d'une session précédente au chargement — cause classique des rapports « les filtres ne marchent pas ». |
| Onglets « Actifs » / « Archivés » / « Inactifs » | OK | OK | `ListeCandidats.tsx:60-64` (`TAB_STATUS_MAP`) — mais neutralise le filtre Statut, cf. **REL-4** |
| Ajouter les candidats manquants dans la CVthèque | OK | OK | — |
| Si le candidat passe en contrat, supprimer l'offre | KO | **PARTIEL** | Masquage OK côté matching : `back/src/repositories/mongo/OfferRepository.ts:63-70` exclut les offres dont `matching.status = CONTRACT` ou dont un candidat matché est en CONTRACT. La transition via l'offre est OK : `back/src/services/OfferService.ts:560-660`. **Manque** : passer un candidat en CONTRAT depuis la liste (`ListeCandidats.tsx:213`) ou la fiche (`FicheCandidat.tsx:344`) ne touche **aucune** offre — elle reste ouverte. Aucun statut d'archivage dans l'enum (`back/src/graphql/offers/typeDefs.ts:4-10`). → **REL-5** |

### 1.4 RH — Matching / Calendrier / Utilisateur

| Tâche | Annoncé | Vérifié | Preuve |
|---|---|---|---|
| Ajouter une entreprise (matching) | OK | OK | — |
| Rediriger depuis les notifications vers candidat/offre | OK | OK | — |
| Bouton supprimer avec motif pour les offres d'entreprises | OK | OK | `deleteOffer` (`back/src/graphql/offers/typeDefs.ts:330`, resolver `:217`) |
| Séparer les AB entreprises par secteur | OK | OK | — |
| Rendre visible l'arrivée de l'AB (mail / alerte) | OK | OK | — |
| Proposer automatiquement le mail de l'entreprise à l'envoi des CV | OK | OK | — |
| Afficher l'adresse du lieu d'activité sur chaque AB | OK | OK | — |
| Bloquer la prise de rendez-vous après 11h30 | OK | OK | `booking_settings` |
| Diviser les agendas par zone géographique | KO | **OK** | Groupement par secteur côté front : `front/.../pages/rh/Calendrier.tsx:919-937` (`AgendasPanel` → un `AgendaGroup` par secteur + « Sans secteur »), défaut = collègues partageant un secteur (`:183`). Filtrage serveur : `back/src/rest/calendar/controller.ts:137` (`shareSector`) — EMPLOYEE ne voit que sa zone, RESPONSABLE voit tout. *Limite* : l'axe zone vient du **secteur de l'utilisateur**, pas du contenu de l'événement ; `GET /api/calendar/events` n'accepte pas de paramètre de zone. |
| Campagnes de relance par secteur | OK | OK | `front/.../pages/rh/Relance.tsx:98-143` |
| Renommer « Nativel Nativel » en « Alice Nativel » | OK | OK | — |

### 1.5 Synthèse

Sur les 10 tâches marquées KO : **4 sont en fait faites** (KPI RH, statut inline, agendas par zone, fiche candidat), **2 sont partielles** (relance effectuée, contrat→offre), **4 restent à faire** (totalCount, filtres, voice over, + découvrabilité). Le reliquat réel tient en 6 tickets, dont 4 en moins d'une journée.

---

## Partie 2 — Reliquat actionnable (`REL-*`)

### REL-1 — Brancher le bouton « Relance effectuée » · S
- **Constat** : toute la chaîne backend existe et fonctionne ; seule l'UI n'a jamais été montée. `PhoneRelanceModal.tsx` et `completePhoneRelance()` sont du code mort depuis leur écriture.
- **Fichiers** : `front/.../pages/commercial/RelanceCommercial.tsx` (bouton à ajouter à côté de « Prise de contact », l.267), `front/.../features/portefeuille/components/PhoneRelanceModal.tsx`, `front/.../src/api/relance.ts:54`.
- **Action** : rendre le modal depuis la page relance, `onConfirm` → `completePhoneRelance(companyId, note)` → refetch de la liste.
- **Done** : un clic + note ⇒ ligne `relance_history` en `PHONE`, `companies.relance_*` remis à NULL, la ligne disparaît de la liste des relances.
- **Note** : ne pas confondre avec « Prise de contact » (`ContactLogModal.tsx:44-67`) qui n'appelle pas les endpoints relance et oblige l'utilisateur à effacer la date à la main.

### REL-2 — `totalCount` sur la pagination candidats · M
- **Constat** : le compteur affiché est la taille de la page (20), pas le total.
- **Fichiers** : `back/src/graphql/candidate/typeDefs.ts:447`, `back/src/graphql/candidate/resolver.ts:115-163`, `back/src/repositories/mongo/CandidateRepository.ts` (`findPage`), `front/.../pages/rh/ListeCandidats.tsx:326`.
- **Action** : `totalCount: Int!` sur `CandidateConnection`, `countDocuments` sur le même filtre que la page (en parallèle du `find`), affichage « X – Y sur Z ».
- **Piège** : en mode recherche, `findPage` ignore `first` et renvoie **tous** les résultats fusionnés `$text` + `$regex` (`CandidateRepository.ts:187-224`) et le front masque la pagination (`ListeCandidats.tsx:284`) — le total n'a alors pas la même sémantique. Traiter les deux branches explicitement.
- **Done** : le total est stable quand on pagine, et cohérent entre mode filtré et mode recherche.

### REL-3 — Fix filtre TP multi-select · S
- **Constat** : `CandidateRepository.ts:121` filtre `{ tp_type: { $in: ... } }`. Or le champ canonique est le tableau `tp_types` (`back/src/types/candidate.types.ts:219`) et `tp_type` n'est que `tp_types[0]` (`back/src/graphql/candidate/resolver.ts:238`). Un candidat `tp_types: ["AD","CC"]` est **invisible** quand on filtre sur CC.
- **Action** : reprendre le pattern déjà correct de `back/src/services/OfferService.ts:189` : `$or: [{ tp_types: { $in: tps } }, { tp_type: { $in: tps } }]`.
- **Done** : un candidat à TP secondaire remonte sur le filtre correspondant. Test de non-régression sur un candidat multi-TP.

### REL-4 — Fix filtre Statut sur les onglets ≠ « Tous » · S
- **Constat** : `statusIn` (issu de l'onglet) écrase `status` (issu du select). `back/src/graphql/candidate/resolver.ts:130` met `status: undefined` dès que `statusIn` est présent, et `CandidateRepository.ts:116-117` est un `else if`. Résultat : sur Actif / Archivé / Inactif, choisir un statut ne fait **rien** — sans aucun retour visuel. `handleTabChange` ne nettoie `filters.status` qu'en quittant « Tous » (`ListeCandidats.tsx:163-168`).
- **Action** : intersecter (`statusIn ∩ status`) plutôt qu'ignorer, ou — plus simple et plus lisible — désactiver/masquer le select Statut sur les onglets qui le contraignent déjà.
- **Done** : plus aucun contrôle de filtre sans effet visible.

### REL-5 — Fermer l'offre au passage en contrat · M
- **Constat** : cf. 1.3. Le chemin « offre → entretien/immersion → contrat » ferme bien la boucle ; le chemin « liste/fiche candidat → statut CONTRAT » laisse l'offre ouverte.
- **Fichiers** : `front/.../pages/rh/ListeCandidats.tsx:213`, `front/.../pages/rh/FicheCandidat.tsx:344`, `back/src/services/OfferService.ts:560-660`, `back/src/graphql/offers/typeDefs.ts:4-10`.
- **Décision produit à trancher avant dev** : supprimer réellement l'offre, ou ajouter un statut `CLOSED`/`ARCHIVED` (l'enum n'a aujourd'hui aucune valeur d'archivage : NOT_MATCHED, MATCHED, CV_SEND, IMMERSING, CONTRACT). L'archivage est recommandé — la suppression détruit l'historique de matching.
- **Done** : quel que soit le point d'entrée du passage en contrat, l'offre correspondante sort du flux de matching.

### REL-6 — Rendre le select de statut visible en liste · XS
- **Fichier** : `front/.../pages/rh/ListeCandidats.tsx:571-586`.
- **Action** : chevron + bordure/hover sur le badge de statut au lieu du `opacity-0` intégral.
- **Done** : un utilisateur non prévenu comprend que le badge est cliquable.

### REL-7 — Voice Over / suivi des appels · à arbitrer
Aucune brique existante. Nécessite un choix d'outil (Ringover, Aircall, Twilio) avec coût récurrent et implications RGPD (enregistrement d'appel = consentement + durée de rétention, à raccorder à `RGPD.md`). **Décision métier avant tout chiffrage** — ne pas planifier en l'état. Palliatif immédiat déjà disponible : le champ `note` de `relance_history` en canal PHONE (activé par REL-1).

---

## Partie 3 — Chantiers EPITECH

### A. Base de données (`DB-*`)

> Contrainte transverse : toute nouvelle colonne MySQL doit être déclarée **en deux endroits** — `database/mysql/mysql-init.sql` (volumes neufs) **et** `REQUIRED_COLUMNS` dans `back/src/db/mysql/migrations.ts` (backfill des volumes existants). Oublier le second = colonne absente en prod.

#### Performance

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| DB-1 | Index MySQL sur colonnes de filtre | 27 index secondaires existent déjà (siren, user_id, conflits, contact_logs, liens…) — le socle est sain. Manquent les colonnes des écrans les plus chargés : `companies.status`, `companies.relance_date` | `database/mysql/mysql-init.sql`, `back/src/db/mysql/migrations.ts` | Profiler les requêtes du portefeuille et des relances (`EXPLAIN`), ajouter les index manquants dans les deux fichiers | `EXPLAIN` sans `ALL` sur les requêtes de liste | S |
| DB-2 | Index Mongo sur les tris/filtres réels | 17 index déclarés (`database/mongodb/mongo-init.js`), dont un index texte et un composite sur `offers` — mais non validés contre les filtres effectifs de `findPage` | `back/src/repositories/mongo/CandidateRepository.ts`, `mongo-init.js` | `explain('executionStats')` sur les combinaisons de filtres les plus utilisées, ajouter les index manquants | Aucun COLLSCAN sur la liste candidats | M |
| DB-3 | Validateurs de données | `candidates.identity.email` est **volontairement non-unique** à cause de doublons en prod (commentaire explicite `mongo-init.js:24-29`, renvoyant à `docs/AUDIT.md §6.4` — fichier **inexistant**, cf. `DOC-1`) | `database/mongodb/mongo-init.js`, `back/src/db/mongo/schemas/` | 1) script de dédoublonnage + rapport, 2) index unique, 3) validators mongoose (email, téléphone, code postal, énumérations) | Index unique posé sans échec, écriture invalide rejetée | L |

#### Sécurité

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| DB-4 | Comptes de moindre privilège | L'application se connecte en **root** sur MySQL (`back/src/config/env.ts:101` défaut `'root'`, `docker-compose.yaml:113`) et avec le compte root initdb sur Mongo. Aucun `CREATE USER` / `GRANT` nulle part | `docker-compose*.yaml`, `back/src/config/env.ts`, scripts d'init | Créer un user applicatif (CRUD sur les tables métier, pas de DDL) + un user lecture seule pour KPI/analytics ; retirer root des variables d'env applicatives | L'app démarre sans identifiants root | M |
| DB-5 | Backups automatisés | **Aucun** `mysqldump`/`mongodump`, aucun cron, aucun job planifié. Les seuls dumps sont des JSON ad hoc écrits par des scripts Python ponctuels dans `scripts/backups/` — répertoire gitignoré | `docker-compose.prod.yaml`, nouveau service ou cron hôte | Dump quotidien MySQL + Mongo, rétention glissante, stockage hors machine, **test de restauration documenté** | Une restauration a été effectuée avec succès au moins une fois | M |
| DB-6 | Chiffrement des données sensibles | Mieux que prévu : mots de passe en bcrypt avec défense timing (`back/src/services/UserService.ts:31,150,224,313`) **et tokens OAuth chiffrés en AES-256-GCM** (`back/src/external/crypto/token-cipher.ts`, chiffrement `UserService.ts:318`, déchiffrement `:81`). **Deux trous restants** : (1) `decryptUserTokens` renvoie tel quel tout token ne matchant pas `isEncryptedToken` (`UserService.ts:79`) — les lignes héritées en clair restent lisibles indéfiniment, aucun backfill ; (2) le **numéro de sécurité sociale candidat est stocké en clair** dans Mongo (cf. `RGPD-5`) | `back/src/services/UserService.ts`, `back/src/external/crypto/token-cipher.ts`, schémas Mongo | Script de backfill chiffrant les tokens hérités puis suppression du chemin de repli en clair ; chiffrer le N° SS | Aucune valeur sensible lisible dans un dump ; `isEncryptedToken` peut devenir une assertion stricte | M |
| DB-7 | « Diviser les tables en différentes bases » — requalification | L'intention (cloisonnement) est bonne, mais séparer physiquement des tables jointes casserait les requêtes. La séparation MySQL (relationnel) / MongoDB (documents candidats & offres) existe déjà et couvre l'essentiel | — | Requalifier l'objectif en : cloisonnement **par utilisateur et par privilège** (= DB-4) + isolation réseau des conteneurs DB. Documenter la décision | Décision écrite et validée | XS |

#### Modularité

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| DB-8 | Fusionner `companies` / `company_conflict` / `companies_blacklist` | 3 tables aux jeux de colonnes quasi identiques (~20 colonnes : nom, téléphone, email, adresse, secteur, activité, siret, idcc, ape, notes, conclusion, status, relance_*) modélisant **le même objet à trois états de cycle de vie** — `mysql-init.sql:~120-196` | `CompanyRepository.ts`, `CompanyConflictService.ts`, écrans portefeuille / quarantine / blacklist | Table unique + colonne d'état, migration des données, adaptation des repos et des 3 écrans | Les 3 écrans fonctionnent sur une table unique, jeux de tests verts | **L — le plus rentable et le plus risqué du lot** |
| DB-9 | Fusionner `commercial_kpi` / `rh_kpi` | Même forme (user, année, mois, semaine + compteurs), séparées uniquement par le rôle | `mysql-init.sql:~100-110` et `:331-342`, `RhKpiService.ts`, service KPI commercial | Table `kpi` unique + discriminant de rôle | Les deux dashboards lisent la même table | M |
| DB-10 | Fusionner `match_link` / `external_link` | Deux tables de liens signés à durée de vie, logique dupliquée | `back/src/repositories/mysql/MatchLinkRepository.ts`, `ExternalLinkRepository.ts` | Table + repository uniques, discriminant de type | Un seul repository de liens signés | M |
| DB-11 | Normaliser `company_conflict.candidate_user_ids` | Liste d'IDs stockée en CSV dans une colonne `text` — non requêtable, non contrainte | `mysql-init.sql`, `CompanyConflictService.ts` | Table de jointure avec clés étrangères | Plus aucune colonne d'IDs sérialisés | S |
| DB-12 | Unifier le vocabulaire des zones | **3 vocabulaires parallèles** pour la même notion : `Nord-Est \| Ouest \| Sud` (`back/src/utils/sector.ts:8`), `NORD \| OUEST \| SUD` côté Drive/AB (`front/.../features/abEntreprise/components/ABDetailContent.tsx:12`), et un `ZoneKey` local dérivé du site de formation (`front/.../pages/rh/Relance.tsx:21-40`). `SECTOR_TO_REGION` (`sector.ts:13-17`) sert de rustine | `back/src/utils/sector.ts`, `front/.../pages/rh/Relance.tsx`, composants AB | Une seule énumération partagée + une seule fonction de dérivation ; supprimer les mappings ad hoc | Un seul jeu de valeurs de zone dans tout le code — **prérequis de FE-3 et FE-4** | M |

#### Colonnes suspectes (à traiter avec DB-8/DB-11)
`companies_blacklist.all_blacklist` (tinyint nullable, sémantique du NULL non définie) · `company_history.updated_column` en `text` libre.

### B. API (`API-*`)

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| API-1 | **Serveur de cache** | **Aucune couche de cache** : ni Redis/ioredis/node-cache dans `back/package.json`, ni memoization applicative, ni plugin de cache Apollo (`back/src/graphql/server.ts`). Les seuls hits « cache » sont des en-têtes HTTP `Cache-Control` | `docker-compose*.yaml`, `back/package.json`, `back/src/external/` (frontière de mock imposée par les conventions de test), services concernés | Ajouter Redis en service, exposer un client via `src/external/`, cacher les lectures chères : `candidateStats`, rapports KPI, réponses SIRENE, listes d'utilisateurs. Prévoir l'invalidation sur écriture | Temps de réponse mesuré avant/après sur les 3 écrans les plus lents ; invalidation testée | L |
| API-2 | Migrer Apollo Server | Encore sur `apollo-server-express` (génération Apollo 2/3, en fin de vie) — `back/src/graphql/server.ts:1`, 4 serveurs instanciés (`:26,32,38,44`) | `back/src/graphql/server.ts`, `back/src/index.ts:152-162` | Migration vers `@apollo/server` v4 | Les 4 endpoints répondent, tests backend verts | L |
| API-3 | Doctrine GraphQL vs REST | Logique métier éclatée entre **5 domaines GraphQL** et **24 dossiers REST** sans règle explicite. Cas emblématique : la complétion de relance est REST-only alors que la modification d'entreprise est GraphQL | `back/CONVENTION.md`, `back/src/rest/`, `back/src/graphql/` | Écrire la règle d'arbitrage dans `CONVENTION.md`, puis migrer les incohérences les plus coûteuses | Règle écrite ; tout nouvel endpoint s'y conforme | M (+ migrations progressives) |
| API-4 | Découpler le domaine `todo` | `todo` a ses typeDefs et resolvers mais aucun serveur : il est fusionné dans `CompanyAPI` (`back/src/graphql/server.ts:15-29`) — couplage arbitraire | `back/src/graphql/server.ts` | Serveur dédié ou rattachement justifié et documenté | Le schéma companies ne contient plus de types todo | S |
| API-5 | Dead code — cadrage honnête | **Aucun service mort trouvé** : les 49 fichiers de `back/src/services/` sont tous importés hors de leurs tests. La cible réelle est ailleurs : 9 services à un **seul** point d'import (`buildCandidateSummary`, `BulkRelanceService`, `CompanyConflictService`, `cvImportDefaultTemplate`, `ImmersionEndNotificationService`, `InterviewMailService`, `pedaDefaultTemplates`, `SignedAbProcessor`, `SourcingService`) + le code front orphelin (`PhoneRelanceModal.tsx`, `api/relance.ts:54`) | `back/src/services/`, `front/.../features/portefeuille/` | Pour chaque service à import unique : inliner ou justifier l'extraction. Front orphelin : brancher (REL-1) ou supprimer — pas d'entre-deux | Plus aucun module exporté et jamais consommé | S |
| API-6 | Dédupliquer la logique de secteur côté back | Voir DB-12 | `back/src/utils/sector.ts` | Fonction unique de dérivation zone ↔ site de formation ↔ région Drive | — | S |

*Chiffres de cadrage* : ~240 fichiers TS hors tests — `rest/` 67, `services/` 49, `external/` 31, `repositories/` 27, `types/` 18, `db/` 15, `graphql/` 14, `mcp/` 11.

### C. Site (`FE-*`)

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| FE-1 | Primitive `<Modal>` partagée | **33 fichiers `.tsx` réimplémentent à la main `fixed inset-0`** — soit 33 backdrops, gestions d'Échap, z-index et verrous de scroll indépendants (45 fichiers mentionnent « Modal ») | nouveau `src/components/ui/Modal.tsx`, puis migration progressive | Une primitive (backdrop, fermeture Échap, focus trap, scroll lock, tailles), migration par lots | Plus aucun `fixed inset-0` hors de la primitive | **L — plus gros gain de factorisation du front** |
| FE-2 | Primitive `<DataTable>` | 6 fichiers avec `<table>` manuel : en-têtes, tri et état vide redupliqués | nouveau `src/components/ui/DataTable.tsx` | Composant générique colonnes + tri + état vide/chargement | Les 6 écrans passent par la primitive | M |
| FE-3 | `<SectorSelect>` partagé | `SECTEUR_VALUES` redéclaré dans 5 écrans : `UserEditModal.tsx:202`, `CreateEditModal.tsx:350`, `RegisterPage.tsx:165`, `PortefeuilleEntreprises.tsx:94`, `EntreprisePage.tsx:403` | `src/components/ui/` | Un composant, une source de valeurs (dépend de DB-12) | Une seule déclaration des secteurs côté front | S |
| FE-4 | Fusionner les deux écrans de relance | `pages/rh/Relance.tsx` et `pages/commercial/RelanceCommercial.tsx` sont deux implémentations parallèles du même écran, avec des modèles de zone divergents | ces 2 fichiers | Écran unique paramétré par rôle, après DB-12 | Un seul composant de relance | M |
| FE-5 | Étoffer le socle UI | `src/components/ui/` ne contient que **11 fichiers, tous orientés formulaire** (Button, InputField, MultiSelectField, PasswordInput, PasswordStrength, RichTextEditor, AddressAutocomplete, SignaturePad, MailModal, RouteBreadcrumb, index) — **pas de `Modal`, `Table`, `Card`, `Badge`, `Drawer`, `Toast`**. Aucun fichier de tokens, styles Tailwind inline partout | `src/components/ui/` | Compléter le socle + fichier de tokens (couleurs, espacements, rayons) | Les nouveaux écrans n'écrivent plus de primitives à la main | L |
| FE-6 | Passe UX/UI | Découvrabilité des actions (cf. REL-6), homogénéité des états de chargement / vide / erreur, accessibilité clavier des modales | transverse | À faire **après** FE-1/FE-2, sinon corrections à répéter 33 fois | Parcours principaux revus et cohérents | L |

*Chiffres de cadrage* : 133 fichiers `.tsx` — `features/` 54 (14 dossiers métier), `pages/` 43, `components/` 33.

### D. Automatisation (`OPS-*`)

| ID | Titre | Constat | Fichiers | Action | Done quand | Taille |
|---|---|---|---|---|---|---|
| OPS-1 | Élargir la CI | `.github/workflows/ci.yml` fait **391 octets** et ne lance **que** les tests backend (`docker-compose.test.yml`). Pas de lint, pas de typecheck, **pas de build ni de lint front du tout** | `.github/workflows/ci.yml` | Ajouter : `npm run lint` (oxlint) + `npm run build` back, `npm run lint` + `tsc -b && vite build` front. Contrainte : les tests back exigent MySQL/Mongo dockerisés (port **3307** en CI, ≠ 3306 réseau compose, ≠ 5001 en local) | Un lint ou un build front cassé bloque la PR | S |
| OPS-2 | Accélérer la CI | Aucun cache de layers Docker ni de `node_modules`, pas de `concurrency` cancel-in-progress | `.github/workflows/ci.yml` | Cache GHA + annulation des runs obsolètes | Durée de CI réduite de façon mesurable | S |
| OPS-3 | **Déploiement automatisé** | **Aucune automatisation** : zéro référence à deploy/ssh/rsync/registry dans `.github/`. `docker-compose.prod.yaml` est déployé à la main | `.github/workflows/` (nouveau), `docker-compose.prod.yaml` | Build + push d'images sur un registry, déploiement déclenché au merge sur `main`, healthcheck et procédure de rollback | Un merge sur `main` met la prod à jour sans intervention manuelle | L |
| OPS-4 | **Patch note** | **Aucun `CHANGELOG`** dans le dépôt, aucune version exposée à l'utilisateur, aucun composant « Nouveautés » côté front | nouveau `CHANGELOG.md`, `front/.../components/`, `package.json` | Générer le changelog depuis les Conventional Commits (le dépôt les respecte déjà : `feat(#470): …`), exposer la version via l'API, afficher une modale « Nouveautés » au premier chargement suivant un changement de version | Une mise en prod produit une note de version lue par les utilisateurs | M |
| OPS-5 | Backups planifiés | = **DB-5**, piloté côté infra | — | — | — | — |
| OPS-6 | Versionner l'application | `front/disciplina-front/package.json` est en version **`0.0.0`**, `back/package.json` en `1.0.0` figé, aucun tag git de release. **Prérequis technique de OPS-4** : sans numéro de version, impossible de déclencher la modale « Nouveautés » sur changement | les 2 `package.json`, tags git | Versionnement sémantique commun, bump automatisé depuis les Conventional Commits, tag à chaque mise en prod | La version affichée dans l'app correspond au tag déployé | S |

---

## Partie 4 — Chantiers non couverts par l'énoncé EPITECH

> Ces chantiers ne figuraient ni dans le backlog du mois ni dans les 4 axes EPITECH. Ils sont issus de l'audit du dépôt et **`RGPD-*` contient des obligations légales, pas des améliorations optionnelles.**

### E. Conformité RGPD (`RGPD-*`)

`RGPD.md` (1045 lignes, juillet 2026) documente **15 failles** avec constat, base légale et correctif — et **n'est même pas versionné** (`git status` : fichier non suivi). Aucune de ces failles n'apparaissait au backlog. Le document reconnaît par ailleurs 11 points **déjà conformes** (bcrypt, chiffrement AES des tokens, rotation des refresh tokens, rate limiting, CSRF double-submit, audit trails, redaction PII dans les logs, HMAC webhooks, CSP/HSTS, Ollama local) — la base technique est saine, ce sont les obligations documentaires et les droits des personnes qui manquent.

| ID | Titre | Faille source | Action | Taille |
|---|---|---|---|---|
| RGPD-0 | **Versionner `RGPD.md`** | — | `git add RGPD.md` — un audit de conformité hors dépôt n'est opposable à personne | XS |
| RGPD-1 | Consentement explicite des candidats | F1 | Checkbox + stockage horodaté du consentement sur les formulaires de collecte | M |
| RGPD-2 | Politique de confidentialité `/privacy` | F2 | Page publique + lien depuis tous les formulaires | S |
| RGPD-3 | Registre des traitements (Art. 30) | F3 | Document, pas de code | S |
| RGPD-4 | Droits des personnes (Art. 12-22) | F4 | Endpoints accès / rectification / suppression / export | L |
| RGPD-5 | **Chiffrer le N° de sécurité sociale** | F5 | Actuellement en clair en base (affiché sur `FicheCandidat.tsx`, section Identité). Donnée Art. 9 → chiffrement au repos + accès restreint. Rejoint `DB-6` | M |
| RGPD-6 | Secrets du dépôt Git | F11 | Nettoyer l'historique, `.gitignore`, remplacer les secrets faibles (`JWTSecret974` → `openssl rand -hex 32`). Voir aussi le fallback DSN Sentry en dur, `front/.../src/main.tsx:13` (TODO explicite) | M |
| RGPD-7 | Mentions légales sur les portails publics | F15 | Footer RGPD sur les portails externes (`publicMatch`, `publicInterview`, `publicCvImport`) + pied de page des mails | S |
| RGPD-8 | Session replays Sentry | F9 | `Sentry.replayIntegration()` est **actif** (`front/.../src/main.tsx`) et enregistre l'UI manipulant des données candidat sans consentement → désactiver ou conditionner au consentement | S |
| RGPD-9 | Durées de conservation + purge | F8 | Jobs de purge automatique — se branche sur `back/src/scheduler/` | M |
| RGPD-10 | IA générative sans consentement | F6 | Bloquer la génération de résumés candidats sans consentement (Art. 22) | S |
| RGPD-11 | DPA sous-traitants | F7, F12 | Google, Sentry, DocuSeal, ClassMarker + bascule DocuSeal vers `api.docuseal.eu` | Doc |
| RGPD-12 | Chiffrement des avatars, minimisation Drive, logs d'accès | F10, F13, F14 | Priorité moyenne selon l'audit | M |

### F. Dette documentaire et qualité (`DOC-*`, `API-7/8`, `FE-7`)

| ID | Titre | Constat | Action | Taille |
|---|---|---|---|---|
| DOC-1 | **`docs/AUDIT.md` n'existe pas** | Le répertoire `docs/` est absent, mais le fichier est cité comme référence faisant autorité depuis **7 endroits** : `back/README.md:257,269`, `back/CONVENTION.md:571`, `back/HOWTOTEST.md:7`, `back/src/services/signedAccess.ts:5`, `database/mysql/mysql-init.sql:284`, `database/mongodb/mongo-init.js:27`. Des décisions techniques (pourquoi telle colonne est morte, pourquoi zod est banni, pourquoi l'email n'est pas unique) renvoient à un document introuvable | Restaurer le document, ou remplacer les 7 renvois par la justification inline | S |
| API-7 | Résorber les violations de convention trackées | `back/CONVENTION.md:582-599` liste **18 violations** connues : logique inlinée dans les routes sans `controller.ts` (×3), **11 classes d'erreur custom** alors qu'elles sont bannies (`SlotUnavailableError` déclarée **deux fois**), `logger.error(err, msg)` au lieu de `{ err }` sur ~18 sites, routes important directement les modèles Mongoose en court-circuitant service **et** repository (`rest/classmarker/webhook.route.ts`, `rest/candidates/route.ts`), un repository et deux services logés sous `rest/`, dossiers camelCase, ré-implémentations de `external/crypto/`. C'est le cœur concret du volet « Modularité API » de l'énoncé EPITECH | Traiter par famille (logging → layering → error classes → structure), en mettant la table à jour. **Ne pas se fier aux mentions « fixed ✅ » sans revérifier** (avertissement du CLAUDE.md projet) | L |
| API-8 | Trois copies de zod dans l'arbre de dépendances | `zod` est banni hors `src/mcp/` mais figure en dépendance directe (`back/package.json:56`, épinglé `3.24.1`) **et** en 3 exemplaires dans le lockfile (racine, `@modelcontextprotocol/sdk`, `chromium-bidi`). Incohérence signalée par `CONVENTION.md:571` | Isoler zod comme dépendance du seul MCP, dédupliquer le lockfile | S |
| FE-7 | Aucun test automatisé côté front | **Zéro framework de test unitaire** (`front/disciplina-front/package.json` n'a ni vitest ni testing-library). Il existe **17 specs Playwright** (`e2e/tests/`, couvrant auth, candidats, matching, booking, KPI, e-signature…) — mais **la CI ne les lance jamais** (cf. `OPS-1`). Côté back : 30 fichiers de test pour ~240 fichiers source | 1) brancher `test:e2e:ci` dans la CI (gain immédiat, le harnais existe déjà), 2) ajouter vitest + testing-library pour les primitives issues de `FE-1`/`FE-2` | M |
| DOC-2 | `E2E.md` non exécutable | Checklist manuelle de régression mappant les flux métier aux tests backend — utile, mais dérive silencieusement du code | Vérifier son alignement à chaque ajout de flux, ou générer la table depuis les fichiers de test | S |

---

## Partie 5 — Séquencement suggéré

**0. À faire tout de suite (minutes, coût nul)**
`RGPD-0` (versionner `RGPD.md`) et `RGPD-8` (couper les session replays Sentry). Le second supprime un enregistrement vidéo non consenti d'écrans contenant des données candidat — il tourne en production aujourd'hui.

**1. Quick wins (≈ 2 j, valeur métier immédiate)**
`REL-3` → `REL-4` → `REL-6` → `REL-1` → `REL-2`. Débloque les utilisatrices RH et ferme la moitié du reliquat du mois.

**2. Filet de sécurité avant tout gros refactor**
`OPS-1` (lint + build front en CI, **et brancher les 17 specs Playwright existantes** — cf. `FE-7`) et `DB-5` (backups). Aucun des chantiers L ci-dessous ne doit démarrer sans ces deux-là : `DB-8` sans backup testé et `FE-1` sans build ni E2E en CI sont des paris.

**2 bis. Piste RGPD, en parallèle et sur une horloge propre**
L'audit fixe ses propres échéances (7 items « dans le mois », 5 « dans le trimestre »). `RGPD-1` à `RGPD-7` ne se négocient pas contre des priorités techniques : ce sont des obligations légales avec un risque de sanction. `RGPD-3` et `RGPD-11` sont du travail documentaire, délégable hors équipe dev.

**3. Fondations (dépendances à respecter)**
- `DB-12` **avant** `FE-3` et `FE-4` — le vocabulaire de zone doit être unifié avant de factoriser les composants qui en dépendent
- `FE-1` et `FE-2` **avant** `FE-6` — refactorer les primitives avant la passe UX, sinon chaque correctif est à répéter 33 fois
- `OPS-1` **avant** `OPS-3` — ne pas automatiser le déploiement d'un code non vérifié
- `OPS-6` (versionnement) **avant** `OPS-4` — sans version, pas de patch note déclenchable
- `DOC-1` **avant** `API-7` — la table des violations renvoie à un audit introuvable, autant restaurer le contexte avant de trancher lesquelles corriger
- `DB-4` et `DB-6` : indépendants, peuvent avancer en parallèle

**4. Gains mesurables**
`API-1` (cache Redis) et `DB-1`/`DB-2` (index) — à faire après avoir **mesuré** les écrans lents, pas avant.

**5. Gros risques, en dernier et isolément**
`DB-8` (fusion des 3 tables entreprises) et `API-2` (migration Apollo v4). Chacun sur une branche dédiée, jamais les deux en même temps.

**Décisions métier bloquantes à obtenir en parallèle** : liste précise des champs manquants sur la fiche candidat (sinon rien à faire), suppression vs archivage de l'offre au passage en contrat (`REL-5`), arbitrage outil et budget pour le suivi d'appels (`REL-7`).
