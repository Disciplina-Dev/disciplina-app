# RGPD — Audit de Conformité du serveur MCP

> **Date** : octobre 2026
> **Branche** : `915-chore-mcp-rgpd-audit`
> **Contexte** : le backend expose un serveur MCP (Model Context Protocol) permettant à des clients LLM (claude.ai, Claude Desktop, Claude Code) de lire le CRM Disciplina.
> **Périmètre** : `back/src/mcp/` (route, auth, RBAC, sérialisation, 45 outils dont 12 péda, OAuth 2.1), tables `mcp_oauth_*`, journalisation associée. Complète [`RGPD.md`](RGPD.md), qui **ne mentionne pas MCP**.
> **Mise à jour** : 9 octobre 2026 — correctifs M2 à M5, M7 à M12 appliqués en code (branche `915-chore-mcp-rgpd-audit`), voir le **Statut** de chaque faille. Suite backend complète exécutée sur la stack `docker-compose.test.yml` : 87 fichiers, 542 tests passés.
> **Mise à jour #930** : ajout du périmètre péda (alternants, séquences d'accompagnement, ruptures) — voir [§ Périmètre péda](#périmètre-péda-930) et [`rgpd/registre-mcp.md`](rgpd/registre-mcp.md).
> **Méthode** : lecture statique du code, des tests et des documents légaux. Aucun test d'intrusion. Les points marqués *(à confirmer)* n'ont pas été vérifiés à la source.

---

## Table des matières

1. [Rappel — flux de données MCP](#1-rappel--flux-de-données-mcp)
2. [M1 — Transfert vers un LLM tiers sans base légale ni DPA](#m1--transfert-vers-un-llm-tiers-sans-base-légale-ni-dpa)
3. [M2 — Consentements candidats ignorés](#m2--consentements-candidats-ignorés)
4. [M3 — Minimisation non respectée](#m3--minimisation-non-respectée)
5. [M4 — Aucun journal d'audit nominatif](#m4--aucun-journal-daudit-nominatif)
6. [M5 — Export en masse possible](#m5--export-en-masse-possible)
7. [M6 — RBAC trop large](#m6--rbac-trop-large)
8. [M7 — Clé statique `MCP_API_KEY` anonyme et ADMIN](#m7--clé-statique-mcp_api_key-anonyme-et-admin)
9. [M8 — Effacement et rétention des données OAuth](#m8--effacement-et-rétention-des-données-oauth)
10. [M9 — Durcissement OAuth (Art. 32)](#m9--durcissement-oauth-art-32)
11. [M10 — Page de consentement non informative](#m10--page-de-consentement-non-informative)
12. [M11 — Effet de bord en lecture](#m11--effet-de-bord-en-lecture)
13. [M12 — Journaux applicatifs](#m12--journaux-applicatifs)
14. [M13 — Registre, documentation et droits des personnes](#m13--registre-documentation-et-droits-des-personnes)
15. [M14 — Tests manquants](#m14--tests-manquants)
16. [Checklist récapitulative](#checklist-récapitulative)
17. [Points hors code à confirmer](#points-hors-code-à-confirmer)

---

## 1. Rappel — flux de données MCP

```
Salarié (compte CRM) ──OAuth / clé statique──► POST /api/mcp ──► outils (lecture)
                                                     │
                                         JSON en clair (fiches)
                                                     ▼
                                   Client LLM (claude.ai, Desktop, Code)
                                                     ▼
                                   Anthropic (sous-traitant ? hors UE ?)
```

| Acteur | Données traitées | Rôle RGPD |
|--------|-----------------|-----------|
| **Centre de formation** | Fiches candidats, entreprises, offres, analyses du besoin, KPI, suivi péda (alternants, sessions, séquences, ruptures) | Responsable de traitement |
| **Salarié utilisateur** | Compte CRM, session OAuth (`mcp_oauth_*`) | Personne concernée + préposé |
| **Éditeur du client LLM (Anthropic)** | Tout résultat d'outil entrant dans le contexte du modèle | Sous-traitant **non contractualisé** |
| **Candidats / contacts entreprise** | Données de leurs fiches | Personnes concernées, non informées de ce flux |

Faits structurants :

- 45 outils (dont 12 péda, `mcp/tools/peda.ts`), tous en lecture via `readTool` (`mcp/tool.ts:23`). Aucun n'écrit ni ne supprime.
- Serveur sans état (pas de session ni SSE), corps limité à 1 Mo (`mcp/route.ts:29`).
- Authentification : OAuth 2.1 (JWT) ou clé statique `MCP_API_KEY`.

---

## M1 — Transfert vers un LLM tiers sans base légale ni DPA

**Gravité : critique** — Art. 6, 9, 13, 28, 35, 44-46

> **Statut** : ⏳ **Ouvert** — hors code (DPA, politique, registre, AIPD). Mitigé en partie par M2/M3 (moins de données sortantes) et M10 (information de l'utilisateur).

### Constat

- Les outils candidats renvoient des fiches complètes (`mcp/tools/candidates.ts`, types : `types/candidate.types.ts:60-80`, `:240-316`), dont :
  - identité, date et lieu de naissance, adresse, email, téléphone ;
  - `psh_referral_request`, `psh_specific_support`, `synthesis.special_needs` : **données de santé / handicap (Art. 9)** ;
  - `emergency_contact` : nom, téléphone, email d'un **tiers** ;
  - résultats de tests ClassMarker avec questions et réponses.
- Ces données entrent dans le contexte d'un LLM hébergé par un tiers. Aucun DPA, aucune analyse de transfert hors UE, aucune AIPD n'est documenté.
- Contradictions documentaires :
  - `politique-confidentialite.md:193` : « Aucune donnée n'est transmise à un fournisseur d'intelligence artificielle externe » ;
  - Anthropic absent des sous-traitants (`politique-confidentialite.md:116-128`) ;
  - `RGPD.md:1070` coche « Ollama hébergé localement (pas de transfert IA vers le cloud) » : plus vrai avec MCP ;
  - le registre (`RGPD.md:208-211`) ne contient pas de traitement MCP.

### Correction

1. Déterminer l'offre Anthropic réellement utilisée (voir [Points hors code](#points-hors-code-à-confirmer)) ; imposer une offre avec DPA, sans entraînement sur les données, et rétention maîtrisée (Team/Enterprise ou API). Interdire les comptes personnels.
2. Signer le DPA, encadrer le transfert (clauses contractuelles types / DPF), l'archiver dans `rgpd/dpas/`.
3. Mettre à jour la politique de confidentialité (sous-traitant, finalité, base légale, durée, transfert) et corriger la phrase de la ligne 193.
4. Ajouter un traitement « Assistance LLM via MCP » au registre (voir M13).
5. Réaliser une AIPD (Art. 35) : données de santé + nouvelle technologie + personnes vulnérables.
6. Base légale à retenir : intérêt légitime (Art. 6.1.f) pour les données courantes, avec test de proportionnalité ; **exclure les données Art. 9** du périmètre MCP (voir M3), faute de base légale évidente.

---

## M2 — Consentements candidats ignorés

**Gravité : critique** — Art. 6.1.a, 7, 21

> **Statut** : ✅ **Corrigé** (`83b08467`) — `ai_processing` strict via `mcp/candidateExposure.ts` (outils candidats, `get_offer`, `list_offers`). Les candidats sans consentement disparaissent de MCP jusqu'au re-consentement. *Tests passés.*

### Constat

- Les consentements `ai_processing`, `data_sharing`, `photo_processing` existent (`consentments`) et un `consentGuard` est appliqué ailleurs (CHANGELOG #639).
- `consentGuard` n'est importé nulle part dans `back/src/mcp/`.
- Le consentement `ai_processing` ne vise que Ollama (local). Aucun mécanisme n'exclut un candidat ayant refusé.
- `get_offer` (`mcp/tools/offers.ts:30-37`) renvoie les candidats suggérés par le matching (`OfferService.find`, `services/OfferService.ts:253`), sans filtre de consentement *(à confirmer dans le service)*.
- `photo_link` est exposé sans contrôle de `photo_processing`.

### Correction

```ts
// mcp/tool.ts — filtrer après lecture, avant sérialisation
const allowed = candidates.filter((c) => c.consentments?.ai_processing === true);
```

- Appliquer le filtre dans les 6 outils candidats et dans `get_offer`.
- Retirer `photo_link` si `photo_processing` est faux.
- Introduire un consentement distinct « traitement par assistant LLM externe » ou documenter la base légale retenue (M1) ; informer du droit d'opposition (Art. 21).

---

## M3 — Minimisation non respectée

**Gravité : haute** — Art. 5.1.c, 25

> **Statut** : ✅ **Corrigé pour les candidats** (`83b08467`) — retirés : `psh_*`, `special_needs`, `emergency_contact`, `classmarker.questions`, photo sans `photo_processing`. `list_offer_history` sans noms ni `ownerEmail`. **Reste** : texte libre des historiques, outils entreprises. *Tests passés.*

### Constat

- Seule redaction : numéro de sécurité sociale → `MASKED_SSN` (`candidates.ts:21-24`, testé `tools.test.ts:59`).
- `serialize.ts:10-25` retire uniquement les clés de type secret (`password`, `secret`, `credential`, `api_key`, `token$`, `hash`, `salt`). Aucune donnée personnelle n'est filtrée.
- Exposés sans besoin démontré : fiche complète en liste (`search_candidates`), `classmarker.questions` / `user_response`, `emergency_contact`, données handicap, `list_offer_history` (`firstName`, `lastName`, `ownerEmail`), `list_candidate_history` (`owner_email`), `list_contact_logs` (texte libre).
- Point positif : `list_users` ne renvoie pas d'email (`tools.test.ts:132`).

### Correction

- Définir un DTO MCP par outil (liste = champs d'identification minimaux ; détail = champs métier nécessaires).
- Exclure par défaut : champs Art. 9, `emergency_contact`, questions de tests, adresse complète, date de naissance exacte (âge suffisant).
- Étendre `serialize.ts` avec une liste d'exclusion par outil plutôt qu'une détection par motif.
- Tests : un test par outil vérifiant l'absence des champs exclus.

---

## M4 — Aucun journal d'audit nominatif

**Gravité : haute** — Art. 5.2, 30, 32

> **Statut** : ✅ **Corrigé** (`ed0ea579`) — table `mcp_audit_log` (init SQL + `REQUIRED_TABLES`), écriture dans `readTool`, purge à 365 jours. *Tests passés.*

### Constat

- `mcp/route.ts:41` : `logger.info({ ip, method, mcpToolName }, 'MCP request')`. Absents : `userId`, arguments (donc personne consultée), nombre de résultats, issue.
- `userId` n'apparaît que dans le log « token accepted » (`mcp/auth.ts:100-103`), à corréler à la main.
- Clé statique : `id: 0`, aucune attribution possible (voir M7).
- Les logs vont sur stdout, sans rétention définie dans le code (`external/logger/logger.ts:81`). La politique annonce 1 an pour les journaux d'accès (`politique-confidentialite.md:165-166`) : rien d'implémenté pour MCP.
- Contraste : les audit trails métier (`candidate_history`, etc.) existent mais ne tracent pas les lectures.

### Correction

- Table `mcp_audit_log` : `id`, `user_id`, `client_id`, `region`, `tool`, `subject_type`, `subject_id`, `args_hash`, `result_count`, `status`, `created_at`. Pas de PII en clair, pas de résultats.
- **Deux emplacements** (convention projet) : `database/mysql/mysql-init.sql` **et** `REQUIRED_COLUMNS` dans `back/src/db/mysql/migrations.ts`.
- Écrire depuis `readTool` (`mcp/tool.ts`) pour couvrir tous les outils.
- Purge à 1 an (job planifié, lié à la Faille 8 de `RGPD.md`).
- Lier à la Faille 14 de `RGPD.md` (journalisation des accès).

---

## M5 — Export en masse possible

**Gravité : haute** — Art. 5.1.c, 32

> **Statut** : ✅ **Corrigé** (`ed0ea579` + pagination) — pages ≤ 50, quota 1000 appels / 2000 fiches par 24 h et par utilisateur ; `list_offers` et `list_needs_analysis` paginés (`first` ≤ 50, `offset`, réponse `{ total, offset, nextOffset, items }`). Alerte `warn` à 80 % du quota. **Reste (mineur)** : les listes par entité (`list_company_history`, `list_contact_logs`, `list_relances`, `list_offer_history`, `list_candidate_history`, `needs_analysis_by_company`) restent non paginées mais bornées à une fiche.

### Constat

- `search_candidates` : `first` ≤ 200 (défaut 50) avec curseur `after` (`candidates.ts:42-43`) ; `search` en texte libre.
- `list_needs_analysis` (`needsAnalysis.ts:24-31`) et `list_offers` (`offers.ts:21-28`) : aucune pagination.
- `search_companies` : pas de `LIMIT` en base ; pagination en mémoire (`companies.ts:18-28`).
- Seul garde-fou : `mcpRateLimiter`, 60 req/min **par IP** (`rest/middleware/rateLimiter.ts:77-85`), soit environ 12 000 fiches/min. Une IP partagée (VPN, NAT) dilue la limite ; une rotation d'IP la contourne.

### Correction

- Quota par utilisateur authentifié (pas par IP) : requêtes/heure et fiches/jour.
- Pagination obligatoire et plafond bas (ex. 50) sur tous les `list_*`.
- Alerte (log `warn` + notification admin) au-delà d'un seuil de lectures distinctes.

---

## M6 — RBAC trop large

**Gravité : haute** — Art. 5.1.f, 25, 32

> **Statut** : ⏳ **Inchangé** — conservé tel quel dans l'attente d'une demande de Disciplina. À noter : la parité avec le CRM (`graphql/authGuard.ts`) rend la largeur d'accès conforme en soi ; les écarts réels sont `kpi_activity userId`, `list_notifications` cross-compte et `sectors` inutilisé.

### Constat

- `checkToolScope` (`mcp/rbac.ts:23-28`) : accès si permission ≥ minimum **ou** rôle métier autorisé. Tout `EMPLOYEE` accède à **tous** les domaines (candidats, entreprises, offres, KPI) ; le test `oauth.test.ts:427` le confirme. Seuls les `GUEST` sont cloisonnés RH / commercial.
- `McpUser.sectors` est renseigné mais **jamais utilisé** pour filtrer.
- Aucun filtre par propriétaire (`owner`) ou secteur.
- `kpi_activity` accepte un `userId` : suivi individuel de performance d'un salarié, non restreint au commercial.
- `list_notifications` : un ADMIN (donc la clé statique) peut lire les notifications de n'importe quel compte (`misc.ts:45-60`).

### Correction

- Aligner les scopes MCP sur ceux de l'application (GraphQL) ; ne pas élargir via MCP.
- Appliquer `sectors` et `owner` dans les requêtes des outils.
- Restreindre `kpi_activity` / `rh_kpi_report` à RESPONSABLE+ ou à soi-même.
- Supprimer l'accès cross-compte de `list_notifications` pour MCP.

---

## M7 — Clé statique `MCP_API_KEY` anonyme et ADMIN

**Gravité : haute** — Art. 5.2, 32

> **Statut** : ✅ **Corrigé** (`eb2736e6`) — clé statique ignorée en production sauf `MCP_STATIC_KEY_ENABLED=true`, `warn` à chaque usage, appels tracés (`user_id` 0). L'OAuth reste actif. *Impact déploiement : les clients Claude Code/Desktop sur clé statique seront refusés en production.*

### Constat

- Identité synthétique `id: 0`, ADMIN / GESTION, `sectors: null`, tenant par défaut (`mcp/auth.ts:26-34`).
- Clé unique partagée, sans expiration ni rotation, non attribuable à une personne.
- Comparaison correcte (`timingSafeEqual`), longueur minimale 32, endpoint désactivé (404) si absente ou trop courte. La longueur de la clé fuit via la vérification d'égalité des longueurs (`auth.ts:18-22`) : mineur.

### Correction

- Désactiver la clé statique en production (OAuth uniquement), ou la réserver à un usage de maintenance journalisé.
- Sinon : une clé par personne, hashée en base, avec `user_id`, expiration et révocation.
- Journaliser chaque usage (M4).

---

## M8 — Effacement et rétention des données OAuth

**Gravité : moyenne** — Art. 5.1.e, 17

> **Statut** : ✅ **Corrigé** (`d58574db`) — suppression de compte : `mcp_oauth_refresh_tokens` supprimés, `mcp_oauth_clients.user_id` mis à NULL ; purge planifiée des jetons expirés (7 j) et des clients inactifs (90 j).

### Constat

- `UserDeletionService` supprime `refresh_tokens` (`services/UserDeletionService.ts:133`) mais **aucune** donnée `mcp_oauth_*`. Les lignes `mcp_oauth_refresh_tokens` survivent à la suppression du compte (identifiant résiduel).
- `mcp_oauth_clients` (`client_name`, `client_uri`, `logo_uri`, `redirect_uris`, `user_id`, `last_used_at`) : aucune rétention ni purge.
- Purge des refresh tokens seulement opportuniste, déclenchée à chaque refresh (`oauth/provider.ts:149`, `:187-193`). Sans refresh, rien n'est supprimé.
- Aucune clé étrangère sur `user_id` (`db/mysql/migrations.ts:346-385`, `database/mysql/mysql-init.sql:288-325`).
- La politique de confidentialité ne donne aucune durée pour ces jetons.

### Correction

- Ajouter `DELETE FROM mcp_oauth_refresh_tokens WHERE user_id = ?` (et mise à `NULL` / suppression de `mcp_oauth_clients.user_id`) dans `UserDeletionService`.
- Job planifié : purge des jetons expirés/révoqués et des clients inactifs depuis N jours (ex. 90).
- Documenter les durées dans la politique (refresh : 30 jours, `tokens.ts:10`).

---

## M9 — Durcissement OAuth (Art. 32)

**Gravité : moyenne**

> **Statut** : 🟡 **Partiel** (`d58574db`) — corrigés : code d'autorisation à usage unique (en mémoire, instance unique), `redirect_uri` revérifié, révocation de session sur rejeu du refresh token, commentaire obsolète. rate limit dédié sur la saisie du mot de passe de `/authorize` (10 échecs / 15 min par IP **et** par compte, `rest/middleware/rateLimiter.ts`) ; le SDK limitait déjà `/authorize` à 100 req / 15 min, `/token` à 50 / 15 min et `/register` à 20 / h par IP. secret de signature dédié `MCP_JWT_SECRET` (optionnel, repli sur `JWT_SECRET` ; à définir en production). **Reste** : DCR ouvert, `client_secret` en clair, access token non révocable (1 h).

### Constat

| Point | Détail |
|---|---|
| Enregistrement dynamique ouvert | `/register` sans authentification (`oauth/router.ts:28`) ; `client_name` et `logo_uri` arbitraires affichés sur la page de consentement : vecteur d'hameçonnage |
| Secret client en clair | `mcp_oauth_clients.client_secret` (`clientStore.ts:51-77`) |
| Code d'autorisation rejouable | JWT sans état, TTL 5 min, pas d'usage unique (`tokens.ts:37-51`) |
| `redirect_uri` non revérifié | `exchangeAuthorizationCode` ne compare que `clientId` (`provider.ts:130-139`) ; PKCE atténue |
| Access token non révocable | JWT HS256 1 h, signé avec `JWT_SECRET` (même secret que les sessions, `typ` distinct) (`tokens.ts:56-79`) |
| Pas de détection de vol de refresh | Réutilisation rejetée mais famille non révoquée (`oauth.test.ts:358`) |
| Brute-force du mot de passe | `/authorize` vérifie email + mot de passe ; le SDK applique 100 req / 15 min / IP (trop lâche pour un mot de passe) : **corrigé**, voir Statut |
| Commentaire obsolète | `index.ts:122` : « Le consentement reste protégé par MCP_API_KEY » : faux |
| Comptes inactifs | Le log parle de compte « inactive » ; `UserRepository.findById` filtre-t-il les comptes désactivés ? *(à confirmer)* |

### Correction

- Restreindre le DCR (liste blanche de clients : claude.ai, Claude Desktop) ou valider strictement `redirect_uris` et afficher l'origine réelle sur la page de consentement.
- Hasher `client_secret` (SHA-256) ou ne pas en émettre (clients publics + PKCE).
- Code à usage unique : stocker le `jti` consommé (table ou cache à TTL 5 min) ; revérifier `redirect_uri`.
- Détection de réutilisation : révoquer tous les refresh tokens du couple `(user_id, client_id)`.
- Rate limit + verrouillage progressif sur `/authorize` et `/token`.
- Secret JWT dédié MCP (`MCP_JWT_SECRET`).
- Corriger le commentaire `index.ts:122`.

---

## M10 — Page de consentement non informative

**Gravité : moyenne** — Art. 12, 13

> **Statut** : ✅ **Corrigé** (`16bf9651`) — encart d'information (transfert vers un modèle d'IA tiers, données de candidats, journalisation, lien politique de confidentialité). Consentement journalisé dans `mcp_audit_log` (`tool=oauth_consent`, `status=consent`, version du texte).

### Constat

- `oauth/consentPage.ts:185-205` affiche le nom du client, « Lecture seule » et le scope `mcp:call`.
- Absent : catégories de données accessibles (dont santé), envoi vers un LLM tiers, responsabilité de l'utilisateur (ne pas coller les données hors cadre), lien vers la politique de confidentialité.

### Correction

- Ajouter un encart : « Les données Disciplina consultées (candidats, entreprises…) seront transmises à [éditeur du client] pour traitement par un modèle d'IA. »
- Lien vers `/legal/confidentialite` et rappel de la charte d'usage interne.
- Journaliser le consentement (date, client, version du texte) dans `mcp_audit_log`.

---

## M11 — Effet de bord en lecture

**Gravité : moyenne** — Art. 5.1.d (exactitude), intégrité

> **Statut** : ✅ **Corrigé** (`d58574db`) — `findByIdReadOnly` / `findPageReadOnly` utilisés par les outils candidats MCP.

### Constat

- `CandidateService.findById` et `findPage` appellent `refreshAvailability` (`services/CandidateService.ts:46-64`) : peut repasser un candidat `UNAVAILABLE` en `SEEKING` et envoyer une notification (`:75-78`).
- Un outil MCP « lecture seule » modifie donc des données, sans trace d'auteur.

### Correction

- Variante sans effet de bord (`findByIdReadOnly`) pour les outils MCP, ou paramètre `{ refresh: false }`.
- Ou journaliser l'écriture avec l'identité MCP dans `candidate_history`.

---

## M12 — Journaux applicatifs

**Gravité : faible** — Art. 5.1.c, 32

> **Statut** : 🟡 **Partiel** (`16bf9651`) — redaction pino étendue à la racine et à deux niveaux. **Reste** : rétention des logs de l'infrastructure, fuite de longueur de clé (mineur).

### Constat

- Redaction pino (`external/logger/logger.ts:41-64`) : chemins `*.email`, `*.phone`, `*.ssn`, `*.birthDate`, etc. `*` ne couvre qu'**un niveau** : les objets imbriqués échappent au masquage.
- Les arguments d'outils et les résultats ne sont pas logués : bon point.
- IP (`req.ip`) loguée sur chaque requête : donnée personnelle, durée à documenter.
- Logs OAuth : `clientId`, `clientName`, `userId`, `region`, `ip` (`provider.ts:88-107`, `:177`) ; l'email saisi n'est pas logué.
- Aucune rétention définie dans le code ; dépend de l'infrastructure (`otel-collector.yaml` *(non lu)*). La politique annonce 30 jours pour les journaux techniques.

### Correction

- Étendre la redaction (`**.email` ou chemins explicites) et tester.
- Fixer et documenter la rétention de l'infrastructure de logs (30 jours / 1 an).

---

## M13 — Registre, documentation et droits des personnes

**Gravité : faible** — Art. 15-22, 30

> **Statut** : 🟡 **Partiel** — fiche de registre ([`rgpd/registre-mcp.md`](rgpd/registre-mcp.md)) et règle `CONVENTION.md` faites. **Reste** : page « Mes connexions MCP ».

### Constat

- Aucun traitement MCP au registre ; le registre lui-même est « non encore constitué » (`rgpd/README.md`).
- `rgpd/dpas/` n'existe pas.
- Aucune UI ni endpoint pour qu'un salarié liste ou révoque ses sessions MCP (seule la révocation OAuth standard `/revoke` existe).
- Droit d'accès / d'opposition des candidats : aucun moyen de savoir si leur fiche a été consultée via MCP (voir M4).
- `back/CONVENTION.md` : aucune règle RGPD ou MCP.

### Correction

- Fiche de registre « MCP » : finalité, base légale, catégories, destinataires (Anthropic), transferts, durées, mesures de sécurité.
- Page « Mes connexions MCP » (liste + révocation).
- Ajouter une règle dans `CONVENTION.md` : tout nouvel outil MCP déclare ses champs exposés, son scope et son filtre de consentement.

---

## M14 — Tests manquants

**Gravité : faible**

> **Statut** : ✅ **Corrigé** — tests ajoutés (passés) pour M2, M3, M4, M5, M8, M9, M10, rétention (audit, jetons, clients), expiration d'access token. **Reste (mineur)** : redaction des logs (pas de test, vérifiée à la main sur pino).

Couvert (`mcp/__tests__/`) : masquage SSN, péda (`peda.test.ts`, `pedaMasking.test.ts`), pagination, `list_users` sans email, RBAC GUEST/EMPLOYEE, rotation du refresh, rejet de réutilisation, région invalide.

Initialement non couvert (depuis ajouté, voir statut) : journal d'audit, masquage hors SSN, filtre de consentement, expiration/purge/suppression d'utilisateur, plafonds et rate limit, rejeu du code d'autorisation, `redirect_uri` divergent.

Reste non couvert : redaction du logger sur objets imbriqués.

Respecter la règle projet : tests de composants, mock limité à `src/external/*`.

---

---

## Périmètre péda (#930)

12 outils péda (`mcp/tools/peda.ts`) + 3 outils de suivi Filiz (`mcp/tools/filiz.ts`), tous en lecture, exposition filtrée par `mcp/pedaExposure.ts` (`PEDA_MIN_GROUP = 5`). Accès : PEDA ou RESPONSABLE+. Détail : [`rgpd/registre-mcp.md`](rgpd/registre-mcp.md).

| Risque | État |
|---|---|
| Consentement `ai_processing` (via `candidate_id`) ; alternants sans candidat lié invisibles | ✅ appliqué |
| Libellé du consentement ne couvre pas explicitement le suivi péda ni un LLM tiers | ⏳ ouvert — DPO |
| Ré-identification par petits effectifs (agrégats) | ✅ masquage k<5 + masquage complémentaire (anti-soustraction) |
| `list_ruptures` nominatif (« Prénom N. »), non masqué par k | ⚠️ accepté — réservé PEDA / RESPONSABLE+ |
| Notifications `peda` / `candidate` en texte libre | ✅ masquées (`misc.ts`) |
| Journal d'audit : sujets `alternantId` / `sessionId` | ✅ `auditStore.ts` (`SUBJECT_KEYS`) |
| Suivi Filiz : miroir local seul, sans `folder_id` / `student_id` / `company_siret`, sans appel Filiz | ✅ `filiz.ts` + `toAlternantFilizDto` (test d'exclusion) |

---

## Checklist récapitulative

### Priorité critique (mois)

- [ ] **M1** DPA Anthropic, offre sans entraînement, mise à jour politique + registre, AIPD
- [x] **M1** Exclure les données Art. 9 du périmètre MCP — *candidats : fait (M3)*
- [x] **M2** Appliquer le consentement `ai_processing` dans les outils candidats et offres

### Priorité haute (trimestre)

- [x] **M3** DTO minimisés (candidats) — *reste `list_offer_history`, textes libres*
- [x] **M4** Table `mcp_audit_log` (init SQL + `REQUIRED_TABLES`) et écriture dans `readTool`
- [x] **M5** Quotas par utilisateur, pages ≤ 50, `list_offers` / `list_needs_analysis` paginés — *reste une alerte de volume (mineur)*
- [ ] **M6** Inchangé — en attente d'une demande de Disciplina
- [x] **M7** Clé statique désactivée en production par défaut

### Priorité moyenne (année)

- [x] **M8** Effacement `mcp_oauth_*` à la suppression d'un compte + purge planifiée
- [ ] **M9** Durcissement OAuth — *fait : code à usage unique, `redirect_uri`, rejeu ; reste DCR, `client_secret`, access token non révocable ; *à faire en déploiement : définir `MCP_JWT_SECRET`**
- [x] **M10** Texte d'information sur la page de consentement
- [x] **M11** Lecture sans effet de bord
- [ ] **M12** Redaction imbriquée ✅ — *reste rétention des logs*
- [ ] **M13** Fiche de registre ✅, règle `CONVENTION.md` ✅ — *reste page « Mes connexions MCP »*
- [x] **M14** Tests (expiration, purge, suppression d'utilisateur, rate limit) — *reste un test de redaction des logs (mineur)*

### Déjà conforme ✅

- [x] Outils en lecture seule (aucune écriture / suppression via MCP)
- [x] Numéro de sécurité sociale masqué (`MASKED_SSN`)
- [x] `list_users` sans email
- [x] Refresh tokens hashés (SHA-256) avec rotation, réutilisation rejetée
- [x] PKCE ; code d'autorisation TTL 5 min
- [x] Rôle relu en base à chaque requête (un compte supprimé perd l'accès)
- [x] Vérification du mot de passe à timing équilibré (hash factice)
- [x] Comparaison de la clé en temps constant ; endpoint désactivé si clé absente ou < 32 caractères
- [x] Serveur sans état, corps limité à 1 Mo
- [x] Erreurs génériques (401 / 500), pas de fuite de données
- [x] Arguments et résultats d'outils non journalisés
- [x] Région validée, cloisonnement multi-tenant
- [x] Journal d'accès nominatif, quotas par utilisateur, purge à 365 jours (M4/M5)
- [x] Consentement `ai_processing` et minimisation des fiches candidats (M2/M3)
- [x] Code d'autorisation à usage unique, révocation de session sur rejeu (M9)
- [x] Effacement des sessions OAuth à la suppression d'un compte (M8)

---

## Points hors code à confirmer

- Offre claude.ai / Anthropic utilisée par chaque salarié (gratuit, Pro, Team, Enterprise) : DPA, entraînement, rétention, localisation.
- Existence d'une charte interne d'usage de l'IA et formation des salariés.
- Rétention effective des logs côté infrastructure.
- Champs exacts exposés par `types/company.types.ts` (contacts entreprise) et par les analyses du besoin (signataires).
- Filtrage des comptes inactifs dans `UserRepository.findById`.
- Filtre de consentement dans `OfferService.find`.
