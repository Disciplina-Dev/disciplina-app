# Classification des données MySQL

Cartographie des 22 tables de la base `disciplina` : niveau de sensibilité, domaine backend
propriétaire, durée de conservation. Sert de base au registre des traitements RGPD et aux
politiques de purge.

Source de vérité du schéma : `database/mysql/mysql-init.sql` (volumes neufs) +
`back/src/db/mysql/migrations.ts` (backfill des bases existantes). Toute évolution doit
toucher **les deux**.

---

## 1. Échelle de sensibilité

| Niveau | Définition |
|---|---|
| **S3** | Secret d'authentification — compromission = prise de contrôle d'un compte ou d'une API tierce |
| **S2** | Identité directe — identifie nommément une personne physique |
| **S1** | Donnée nominative d'appréciation — rattachée à une personne identifiée, soumise au droit d'accès/rectification, non secrète |
| **S0** | Non personnel — paramétrage, référentiel |

---

## 2. Tables

### Identité & authentification

| Table | Sens. | Colonnes sensibles | Domaine backend | Rétention |
|---|---|---|---|---|
| `users` | S3+S2 | `password`, `oauth_token`, `refresh_token`, `email`, `first_name`, `last_name` | `UserRepository`, `rest/auth/` | Durée du contrat + obligations légales |
| `refresh_tokens` | S3 | `token_hash` (sha256) | `RefreshTokenRepository` | Purge à expiration + 7 j |
| `roles` | S0 | — | `UserRepository` | Permanent (référentiel RBAC) |
| `permissions` | S0 | — | `UserRepository` | Permanent (référentiel RBAC) |

`users` est le **hub relationnel** : 13 tables le référencent en clé étrangère. C'est la cible
d'un export ou d'un effacement sur demande d'un collaborateur.

### Prospection entreprises (CRM)

| Table | Sens. | Colonnes sensibles | Domaine backend | Rétention |
|---|---|---|---|---|
| `companies` | S2 | `legal_referent`, `email`, `phone`, `address`, `siret` | `CompanyRepository`, `CompaniesService` | 3 ans sans contact (reco CNIL, prospection B2B) |
| `company_conflict` | S2 | idem + `candidate_user_ids` | `CompanyConflictRepository` | Purge après résolution du conflit |
| `companies_blacklist` | S2 | idem | `CompanyBlacklistRepository` | Conservation longue justifiée (opposition au démarchage) |
| `company_history` | S1 | `modified_by`, `changes` | `CompanyHistoryRepository` | Suit `companies` (CASCADE) |
| `contact_logs` | S1 | `comment` (texte libre sur un prospect) | `ContactLogRepository` | Suit `companies` (CASCADE) |
| `relance_history` | S1 | `subject`, `note` (contenu de mails) | `RelanceHistoryRepository`, `BulkRelanceService` | Suit `companies` (CASCADE) |

Données personnelles de **tiers** (référents légaux de prospects) : durée de conservation
distincte de celle des collaborateurs.

### Indicateurs nominatifs

| Table | Sens. | Colonnes sensibles | Domaine backend | Rétention |
|---|---|---|---|---|
| `commercial_kpi` | S1 (+S2) | `user_name` (nom dénormalisé) | `KpiRepository`, `rest/kpi/` | Anonymisation au-delà de N années |
| `rh_kpi` | S1 | `user_id` | `RhKpiRepository`, `rest/rh-kpi/` | Idem |

Données d'évaluation de la performance individuelle : catégorie à part en droit du travail,
accès à restreindre.

### Accès éphémères (tout porte un `expires_at`)

| Table | Sens. | Colonnes sensibles | Domaine backend | Rétention |
|---|---|---|---|---|
| `filiz` | S3 | `token` (API tierce) | `FilizRepository` | Purge à expiration |
| `interview_access` | S3+S2 | `signature`, `code`, `rh_email`, `candidate_id` | `InterviewAccessRepository` | Purge à expiration + 7 j |
| `match_link` | S3+S2 | `signature`, `code`, `rh_email`, `company_email` | `MatchLinkRepository` | Idem |
| `external_link` | S3+S2 | `signature`, `code`, `external_email`, `rh_email` | `ExternalLinkRepository` | Idem |

Ces tables sont des couples signature/code d'accès associés à des emails. Les conserver
au-delà de leur expiration n'a aucune valeur métier et allonge la surface d'exposition.
Purgées par `back/src/scheduler/expiredAccessScheduler.ts`.

### Paramétrage & divers

| Table | Sens. | Colonnes sensibles | Domaine backend | Rétention |
|---|---|---|---|---|
| `app_settings` | S0 | — (peut contenir des gabarits de mail) | `AppSettingsRepository` | Permanent |
| `sector_settings` | S0 | — | `SectorSettingsRepository` | Permanent |
| `booking_settings` | S0 | clé = `user_id` (pseudo-personnel) | `rest/booking/repository.ts` | Suit `users` (CASCADE) |
| `peda_config` | S0 | clé = `user_id` | `PedaConfigRepository` | Suit `users` (CASCADE) |
| `peda_draft_history` | S2 | `recipient` (email) | `PedaDraftHistoryRepository` | 12 mois (déduplication d'envois) |
| `todos` | S1 | `title`, `description` (texte libre) | `TodoRepository` | Suit `users` (CASCADE) |

---

## 3. Références sans intégrité garantie

À connaître avant toute opération de purge ou d'effacement : ces liens ne sont pas des clés
étrangères, le SGBD ne les maintient pas.

- `company_history.modified_by` — identifiant utilisateur, aucune FK.
- `company_conflict.candidate_user_ids` — liste d'identifiants stockée en `text`.
- `interview_access.offer_uuid` / `candidate_id`, `match_link.offer_uuid`,
  `external_link.external_uuid` — références **vers MongoDB** (offres, candidats). Aucune
  contrainte possible, cross-SGBD.

Conséquence : supprimer un utilisateur ou une offre ne nettoie pas automatiquement ces
lignes.

---

## 4. Points d'arbitrage ouverts

1. **`commercial_kpi.user_name`** — nom dénormalisé, donnée personnelle dupliquée depuis
   `users`. La supprimer imposerait une jointure sur `users` et ferait perdre l'historique
   des utilisateurs supprimés (`user_id` est `ON DELETE SET NULL`) — c'est précisément la
   raison d'être de la colonne. Statut : conservée, documentée.
2. **`peda_draft_history.recipient`** — email destinataire en clair, alors qu'il ne sert
   qu'à la déduplication d'envois. Pourrait n'être qu'un hash. Statut : à trancher.

---

## 5. Découpage multi-schémas : étudié et écarté (#511)

Un découpage de `disciplina` en 5 schémas isolés (`_core`, `_crm`, `_kpi`, `_tokens`,
`_config`) a été étudié sur la base de cette classification, puis **abandonné**.

Le bénéfice attendu était l'isolation par droits : un compte MySQL par schéma, en moindre
privilège. C'est inapplicable en l'état — `back/src/repositories/mysql/KpiRepository.ts`
(L99-180) et `RhKpiRepository.ts` (L47) joignent `users` avec `companies`, `contact_logs` et
`company_history` dans une même requête. Un compte cantonné à un schéma casse ces requêtes ;
un compte unique habilité sur les cinq schémas ramène le découpage à un renommage.

Coût par ailleurs élevé : ~20 repositories à requalifier, `migrations.ts` (~600 lignes),
`env.ts`, trois fichiers compose et le job de backup, sur de la donnée de production.

Les besoins réels sous-jacents ont été traités directement, sans découpage :

- compte applicatif MySQL non-root à droits limités (l'application tournait en `root`) ;
- purge planifiée des tables d'accès éphémères ;
- ce document, comme base de registre des traitements et de politique de rétention.

Reconsidérer le découpage seulement si un besoin d'isolation **physique** apparaît (charge,
souveraineté, hébergement séparé) — pas pour un gain d'organisation.
