# Changelog

Ce fichier retrace les évolutions de l'application Disciplina, version par version.
Il est mis à jour **manuellement**, à chaque fusion de branche sur `main`.

> ⚠️ **Synchronisation** : ce fichier est une **copie** destinée au frontend
> (`front/disciplina-front/src/content/CHANGELOG.md`). La source de vérité est le
> fichier racine `CHANGELOG.md`. Toute modification doit y être reportée avant de
> déployer le front.

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

### Added

- Consentement RGPD à la création d'une fiche candidat : 4 cases à cocher
  distinctes (traitement des données — obligatoire, partage avec les
  entreprises partenaires, traitement par IA locale pour le résumé de profil,
  stockage de la photo/avatar). Objectif : établir une base légale explicite
  pour la collecte des données du candidat, dès la création de sa fiche et non
  plus seulement via la signature en fin de document.
- Script de rétro-consentement (`back/scripts/migrate-candidate-consentments.ts`)
  pour les fiches candidat créées avant l'introduction de ce champ.

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
- TEST -- TEST

### Fixed

- Accès « Responsable » cassé rétabli sur certains espaces.
- Correctifs de sécurité (champ NIR, surfaces d'exposition).