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