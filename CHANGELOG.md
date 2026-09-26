# Changelog

Ce fichier retrace les évolutions de l'application Disciplina, version par version.
Il est mis à jour **manuellement**, à chaque fusion de branche sur `main`.

> ⚠️ **Synchronisation** : l'application lit une copie de ce fichier dans
> `front/disciplina-front/src/content/CHANGELOG.md`. À chaque modification,
> penser à reporter les changements dans cette copie avant de déployer le front.

## Conventions

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

- Une section par version : `## [x.y.z] - AAAA-MM-JJ`, précédée d'une section
  `## [Unreleased]` qui regroupe les changements en attente de déploiement.
- Les changements sont répartis en catégories :
  - `### Added` — nouvelles fonctionnalités.
  - `### Changed` — modifications de l'existant.
  - `### Deprecated` — fonctionnalités appelées à disparaître.
  - `### Fixed` — corrections de bugs.
  - `### Security` — correctifs de sécurité.
- Versionnement sémantique `major.minor.patch` :
  - **Major** : changement cassant (suppression ou rupture de comportement d'une
    fonctionnalité, changement d'API).
  - **Minor** : nouvelle fonctionnalité rétrocompatible.
  - **Patch** : correction de bug.
- À chaque déploiement : renommer `## [Unreleased]` en `## [x.y.z] - AAAA-MM-JJ`
  (incrément selon les règles ci-dessus), puis ouvrir une nouvelle section
  `## [Unreleased]` vide.

## [Unreleased]

## [1.3.0] - 2026-09-18

### Added

- Socle multi-tenant Annemasse (#709, #716) : second tenant avec bases MySQL/Mongo dédiées, routage backend par région du JWT (`db/tenant.ts`, `mongo/tenant.ts`), OAuth Google, webhooks ClassMarker/YouSign, SSE et schedulers régionalisés. Correctifs d'écarts (#717, #718), script de migration `migrate-multi-tenant.py`, jeu de données de test `seed_annemasse_test_data.py` et documentation de déploiement (#730, #731).
- Sélection de la région au login et badge de région permanent (#724) : choix du tenant (Réunion/Annemasse) dans le formulaire de connexion (mémorisé en `localStorage`), badge visible dans les cinq espaces, `/portail` redirige vers `/login`.
- Authentification OAuth du serveur MCP et RBAC par outil (#712, #723) : consentement par compte CRM (email/mot de passe/région), tokens délimités par région, chaque outil MCP scopé en miroir des guards GraphQL, `list_notifications` restreint à l'utilisateur courant.
- Liste des entreprises actives sur le dashboard RH (#739, #744) : champ `lastActiveAt` alimenté par les AB et les offres.
- Envoi des PDF au commercial à la signature d'une AB (#713, #746) : `SignedAbProcessor` et le contrôleur YouSign transmettent les documents signés par mail.
- Encadré « déjà envoyé » sur la fiche candidat (#748, #751) : `CandidateSentCompaniesCallout` liste les entreprises déjà destinataires du profil.
- Question optionnelle sur les plateformes de recherche d'emploi (#755, #756) : champ `job_search_platforms` sur la fiche candidat (formulaires, questionnaire AB, PDF).
- Seuils de validation des tests par TP (#738, #740) : moyenne minimale de 10 pour CC, 12 pour NTC/REM/AD/SA (`testGateThreshold`), création rapide de candidat (`CandidateQuickCreateModal`).
- Redirection Drive sur les AB signées depuis le matching (#700, #701).
- Statut « Non renseigné » pour le In-Contract candidat (#698, #699) : `ContractModal`/`JobSearchModal`.
- Champ de recherche dans le calendrier (#706, #707).
- Secteur d'activité multi-sélection pour les entreprises (#710, #719) : `CreateEditModal`, fiche entreprise et filtres du portefeuille.
- Notification à la bascule d'un candidat vers `in_contract` (#711, #720).
- Interface de gestion des accès externes (#692) : pilotage des liens `/external/*`.
- Scripts de déploiement/rollback (`scripts/deploy.sh`, `scripts/rollback.sh`) et guide `HOWTODEPLOY.md` (#730, #731, #734, #736).

### Changed

- Liens externes sans code d'accès (#715, #757) : suppression de la génération/exigence de code (`ExternalAccessService`, `MatchAccessService`), contrôleurs et garde simplifiés.
- Mentions légales : placeholders remplacés par le contenu final (#742, #743).
- Nommage « Catalogue » pour la sauvegarde Drive et l'envoi mail des PDF d'AB signées (#745, #749).
- Historique du matching : entrées automatiques et manuelles distinguées, avec filtre (#753, #754).

### Fixed

- Comptage KPI des entretiens candidat issus de l'import CV externe (#704, #705).
- Anomalie MCP sur les offres (#737, #741) : filtrage via `OfferRepository`/`OfferService`.

## [1.2.0] - 2026-09-14

### Added

- Garde de consentement RGPD (`services/consentGuard.ts`, #639) : vérification du consentement candidat avant génération de résumé IA (`AI_PROCESSING`), affichage/partage d'avatar (`PHOTO_PROCESSING`) et partage avec les entreprises (`DATA_SHARING` — Filiz, matching CV/liste). Mode `warn` transitoire avec log, filtrage silencieux pour la liste externe.
- Champs de planning sur les offres et l'analyse de besoin (#605) : horaires hebdomadaires persistés (Mongo `needsAnalysis`/`matching`), saisis dans `NeedsAnalysisModal`/`JobSearchModal`, injectés dans le mail d'offre au candidat et le PDF AB.
- Regroupement des tâches identiques (#628) : `TodoGroupRepository` + `TodoService` groupent les tâches partageant le même intitulé, `GroupSelector` côté front, migrations MySQL associées.
- Recherche candidat améliorée (#611) : index texte MongoDB v2 avec tokenisation et normalisation, refonte de `CandidateRepository` pour une recherche plus pertinente.
- Politique d'application compacte dans la sidebar (#524) : composant `LegalLinks` et constantes `legalLinks.ts` affichés dans `AdminLayout`, `CommercialLayout`, `EntrepriseLayout`, `PedaLayout` et `RHLayout`.
- Statuts de conclusion d'entretien (#627) : nouveaux statuts de résultat d'entretien sur les offres, `InterviewConclusionModal` mis à jour.
- Suppression d'entreprise avec modale de confirmation et notification (#664) : `DeleteCompanyModal`, `SirenGroupCard`/`EntrepriseCard` et `portefeuilleStore`.
- Suppression d'utilisateur en soft delete (#662) : colonnes `is_deleted`/`deleted_at` sur `users`, `UserDeletionService` et `DeleteUserModal` côté admin, conservation des références KPI/candidats/entreprises.
- Filtre global des entreprises (#626) : `FilterPanel`/`statusConfig` et `companyMapper` permettent de filtrer l'ensemble du portefeuille.
- Unification des KPI dans MongoDB (#513) : collection unique `kpis` (`kind: commercial|rh`), `KpiRepository`/`RhKpiRepository` Mongo, migration automatique au boot (`legacyKpiImport.ts`, `scripts/migrate-kpi-to-mongo.ts`), suppression des DDL MySQL associées.
- Tag « Véhicule » (`hasVehicle`) sur candidat et AB (#671) : champ conditionnel candidat/AB, affiché dans `CandidateFormModal`, `ABDetailModal`/`ABDetailContent` et le PDF.
- Toggle d'activation des relances par AB (#681) : champ `shouldRelance` (`needsAnalysis.schema`, `NeedsAnalysisService`, `ABDetailModal` + hooks/queries `useUpdateShouldRelance`).
- Bouton « Voir l'AB » sur les pages de matching (#725) : `AbHeader` et `JobDetailsSection` dans `Matching.tsx` (`/rh/matching?needsAnalysis=…`), `NeedsAnalysisCard` (liste `/rh/matching`) et `MatchedJobsList` (fiche candidat) ouvrent `ABDetailModal` pour consulter l'analyse de besoin sans quitter le contexte matching.

### Changed

- Contenu du mail d'offre au candidat ajusté (#603) : ajustements mineurs dans `Matching.tsx`.
- Mails externes : en-tête `Reply-To: noreply@disciplina.re` ajouté à tous les envois Gmail (`mime.builder.ts`, `no-reply.ts`, #601) ; `From` Gmail conservé.
- KPI : bascule MySQL → MongoDB avec bump atomique via pipeline `$replaceWith` + clamp `$max`, noms résolus via `UserRepository.findByIds` (#513).
- Rework complet des accès externes (#514) : flux unifiés profil matché / réservation d'entretien / import CV sous `/external/*`. Les anciens liens `/public/*` déjà envoyés par email redirigent automatiquement vers le nouveau flux. Le code d'accès est désormais envoyé par email au chargement de la page (et plus dans l'email d'invitation), le lien de réservation d'entretien s'affiche sous forme de bouton « Choisir mon créneau ». Tables `interview_access`, `match_link` et `external_link` consolidées dans `external_access`.
- `ABDetailModal` : rendu via `createPortal` sur `document.body` et dimensions élargies (`max-w-3xl`, `max-h-[88vh]`, `items-center justify-center`) pour garantir un affichage centré et lisible même depuis la vue matching détaillée.

### Fixed

- Vérifications des créneaux indisponibles du calendrier (#598) : `InterviewAccessService` et `flow.test.ts`.
- Planning AB : tests et corrections du schedule (#644).
- Case à cocher de consentement RGPD (#654) : `candidate.mapper.ts`.
- Erreurs pré-existantes de lint/tests/e2e (#656).
- Filtrage par secteur dans le matching (#670) : correction `CandidateService`/`OfferService` + utilitaire `zone.ts`.
- Offres inactives exclues de la recherche d'offres côté candidat (#672) : `OfferRepository`/`CandidateService`.
- Affichage du recruteur même si e-mail/téléphone identique au représentant (#678) : `OfferService`/`needsAnalysis.mapper` et `CompanyInfoModal`/`Matching.tsx`.
- Fuseau horaire des entretiens sur la page de matching (#676) : `InterviewProposalForm`, `InterviewSlotPicker`, `Matching.tsx`.
- Placement des boutons (chevauchement) (#681).
- Hooks pré-commit contournables corrigés (#658) : `skip hooks` ne bypass plus les vérifications.
- Filtres de statut des accès externes (#514) : `ExternalAccessRepository.findAllFiltered` utilisait `IN (?)` avec un tableau, non développé par `pool.execute()` (prepared statements) — le statut arrivait comme un littéral unique et chaque onglet renvoyait un résultat vide. Placeholders énumérés `IN (?, ?, …)` pour les filtres `statuses` et `types`.
- Modal de détail d'AB tronquée/mal centrée depuis une page de matching sélectionnée (#725) : `ABDetailModal` tronquée par le layout `backdrop-blur`/`overflow` du matching (affichage à moitié hors écran en haut) ; corrigé par portail pleine-page, centrage `items-center justify-center` et hauteur `max-h-[88vh]` avec scroll interne.

## [1.1.0] - 2026-08-20

### Added

- Consentement RGPD à la création d'une fiche candidat : 4 cases à cocher
  distinctes (traitement des données — obligatoire, partage avec les
  entreprises partenaires, traitement par IA locale pour le résumé de profil,
  stockage de la photo/avatar). Objectif : établir une base légale explicite
  pour la collecte des données du candidat, dès la création de sa fiche et non
  plus seulement via la signature en fin de document.
- Script de rétro-consentement (`back/scripts/migrate-candidate-consentments.ts`)
  pour les fiches candidat créées avant l'introduction de ce champ.
- Notification lors de la signature d'une AB (alternance bout en main).
- Logique de secteur appliquée au back-end (KPI, calendrier).
- Champ et filtre « genre » pour les candidats.
- Indicateur « a un CV » et option « ne pas envoyer » dans la modale de
  proposition.
- Sauvegarde automatique des bases de données.
- Les AB signées sont rangées dans des sous-dossiers pour faciliter le tri.
- Les tâches peuvent être assignées à d'autres utilisateurs (avec notification
  lors de l'assignation).
- Boutons « venu / pas venu » pour les événements créés hors de l'application
  (KPI).
- Nouveaux champs de recherche de candidats (téléphone, e-mail).
- Filtre de statut « sans emploi » appliqué au matching.
- À l'assignation d'un contrat, toute entreprise peut être recherchée, sans
  restriction de TP.
- Recherche d'entreprise insensible à la casse.

### Changed

- Le statut des AB (`AB_STATUS`) est désormais un champ persistant, modifiable
  manuellement.
- Les AB signées donnent la priorité aux comptes « rechargeables », avec repli
  sur un autre commercial connecté.
- Refonte du remplacement des variables dans les templates de mail (plus de
  templates utilisent des variables).
- Expiration des liens de matching portée de 24 h à 72 h.
- Amélioration du prompt de génération de description IA.

### Fixed

- Sanitisation des filtres persistés (`persistedListView`).
- Les AB sont enregistrées dans le drive de leur secteur, au lieu de celui du
  commercial.
- Exclusion des secteurs d'activité personnalisés sur les AB ; le matching
  recherche désormais aussi hors de ces secteurs.
- Correction de la logique de calcul du chiffre d'affaires (MySQL).
- Migration et chiffrement du SSN (NIR) en production.
- Nettoyage du tag immersion après un changement de statut.
- Correction de la logique de quarantaine.

### Security

- Correctif CSRF Apollo.
- Validation renforcée du webhook Docuseal (schéma/HMAC invalide).

## [1.0.0] - 2026-08-05

### Added

- Espace légal public : pages CGU (interne, candidat, entreprise), mentions
  légales, politique de confidentialité, politique cookies et bannière de
  consentement.
- Automatisation de la signature des relances (PDF signé ajouté aux modèles de
  relance).
- Filtre TP réglable sur les modales d'ajout de candidats.
- Chiffrement du NIR (numéro de sécurité sociale) des candidats au repos.
- Badge « Responsable » visible dans la navigation des espaces.

### Changed

- Le changement de statut de contrat d'un candidat est désormais synchronisé
  depuis la liste des candidats vers les offres.
- Refonte des mails de relance.

### Fixed

- Accès « Responsable » cassé rétabli sur certains espaces.
- Correctifs de sécurité (champ NIR, surfaces d'exposition).