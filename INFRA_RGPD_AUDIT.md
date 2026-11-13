# Audit RGPD de l'infrastructure — Disciplina

> Date : 2026-11-10 · Périmètre : infrastructure d'hébergement, sauvegardes, exposition réseau, journalisation, sous-traitants, flux de données personnelles.
> Hors périmètre : audit applicatif détaillé (voir `RGPD.md`, `MCP_RGPD_AUDIT.md`).
> Ce document n'est pas un avis juridique : il doit être validé par le DPO / un conseil.

## Sommaire

1. [Standards RGPD applicables à un serveur](#1-standards-rgpd-applicables-à-un-serveur)
2. [Contexte de l'infrastructure actuelle](#2-contexte-de-linfrastructure-actuelle)
3. [Non-conformités constatées](#3-non-conformités-constatées)
4. [Points à vérifier côté production (hors repo)](#4-points-à-vérifier-côté-production-hors-repo)
5. [Exigences pour l'architecture cible](#5-exigences-pour-larchitecture-cible)
6. [Plan d'actions](#6-plan-dactions)

---

## 1. Standards RGPD applicables à un serveur

### 1.1 Articles du RGPD (règlement UE 2016/679)

| Article | Exigence | Conséquence pour l'hébergement |
|---|---|---|
| Art. 5-1-c | Minimisation | Ne stocker/journaliser que le nécessaire (logs, traces, replays). |
| Art. 5-1-e | Limitation de la conservation | Durées de rétention définies et purges effectives (DB, sauvegardes, logs). |
| Art. 5-1-f | Intégrité et confidentialité | Protection contre accès non autorisé, perte, destruction. |
| Art. 24-25 | Responsabilité, protection dès la conception | Paramètres par défaut protecteurs (ports fermés, chiffrement, moindre privilège). |
| Art. 28 | Sous-traitants | Contrat (DPA) avec chaque hébergeur / service tiers ; garanties suffisantes. |
| Art. 30 | Registre des traitements | Registre à jour, incluant destinataires, transferts, durées, mesures de sécurité. |
| Art. 32 | Sécurité du traitement | Pseudonymisation et **chiffrement**, confidentialité/intégrité/**disponibilité**/résilience, **capacité de restaurer** les données, **tests réguliers** des mesures. |
| Art. 33-34 | Violation de données | Détection et notification à la CNIL sous **72 h** ; information des personnes si risque élevé. Impose journalisation et supervision. |
| Art. 35 | Analyse d'impact (DPIA) | Obligatoire si traitement à risque élevé (données sensibles à grande échelle, IA, etc.). |
| Art. 44-49 | Transferts hors UE | Décision d'adéquation, clauses contractuelles types (+ analyse d'impact du transfert) ou autre garantie. |
| Art. 15-22 | Droits des personnes | Accès, rectification, effacement, portabilité, opposition : l'infra doit permettre d'extraire/effacer (y compris dans les sauvegardes, selon durée de vie). |
| Art. 9 | Données sensibles | Ici : handicap (PSH), numéro de sécurité sociale (traitement encadré, NIR) → mesures renforcées. |

### 1.2 Référentiels de sécurité de référence

- **CNIL — Guide de la sécurité des données personnelles** (fiches : authentifier les utilisateurs, gérer les habilitations, tracer les accès, sécuriser les postes, sécuriser le réseau interne, sécuriser les serveurs, sauvegarder, archiver, chiffrer, encadrer la maintenance et les sous-traitants).
- **ANSSI — Guide d'hygiène informatique** (42 mesures), recommandations TLS, administration sécurisée, journalisation.
- **ISO/IEC 27001 / 27002** : référence de management de la sécurité ; l'hébergeur cible devrait être certifié.
- **SecNumCloud (ANSSI)** : qualification pour cloud de confiance (protection contre lois extra-européennes). Recommandée, non obligatoire ici.
- **HDS (Hébergeur de Données de Santé)** : à évaluer. Les données de handicap relèvent de données de santé ; le recours à HDS dépend de la nature (données de santé collectées dans le cadre de soins/suivi médico-social). À trancher avec le DPO.

### 1.3 Checklist « serveur conforme »

| # | Exigence | Détail attendu |
|---|---|---|
| S1 | Localisation | Hébergement dans l'UE (idéalement France), DPA signé avec l'hébergeur, sous-traitants ultérieurs connus. |
| S2 | Chiffrement au repos | Disque chiffré (LUKS / FileVault / chiffrement fournisseur) + chiffrement applicatif des champs sensibles (NIR, santé). |
| S3 | Chiffrement en transit | TLS ≥ 1.2 partout côté Internet ; TLS entre app et DB si elles ne sont pas sur le même hôte ; HSTS. |
| S4 | Sauvegardes | Règle **3-2-1** (3 copies, 2 supports, 1 hors site), **chiffrées**, couvrant **tous** les tenants, rétention définie, **test de restauration** périodique, alerte en cas d'échec. |
| S5 | Cloisonnement réseau | Pare-feu deny-by-default ; seuls 80/443 publics ; SSH par clé (ou VPN), pas de DB/outils d'admin exposés. |
| S6 | Moindre privilège | Comptes applicatifs DB distincts et limités ; pas de root applicatif ; séparation par tenant. |
| S7 | Journalisation | Logs d'accès/admin centralisés, rotation, rétention définie (CNIL : 6 mois à 1 an pour les logs de sécurité), pas de PII superflue. |
| S8 | Supervision et incident | Monitoring de disponibilité, alertes, procédure de gestion de violation (72 h). |
| S9 | Gestion des secrets | Secrets hors dépôt, rotation, pas dans les logs ni en argument de ligne de commande. |
| S10 | Mises à jour | Patching OS/images, images pinées, scan de vulnérabilités et de secrets en CI. |
| S11 | Durcissement conteneurs | Utilisateur non-root, `no-new-privileges`, limites de ressources, healthchecks, images non `:latest`. |
| S12 | Résilience / PRA | Plan de reprise documenté (RPO/RTO), alimentation et connectivité redondantes ou hébergeur professionnel. |
| S13 | Accès physique | Serveur en local sécurisé (datacenter) ; pas de poste de bureau sans contrôle d'accès. |
| S14 | Documentation | Registre Art. 30, DPIA, politique de confidentialité exacte (sous-traitants réels), DPAs archivés. |

---

## 2. Contexte de l'infrastructure actuelle

- **Hébergement de production** : un Mac mini au siège de Disciplina à La Réunion, exposé via la box Internet (redirection de ports) et un Caddy installé sur l'hôte (config hors dépôt).
- **Stack** : Docker Compose — MySQL 8.4, MongoDB 8.2, Ollama (qwen2.5:3b local), backend Node/Express/GraphQL/MCP, frontend nginx.
- **Deux tenants** : `disciplina` (La Réunion) et `disciplina_annemasse` (Annemasse), **sur le même hôte et le même serveur de bases de données**, séparés au niveau applicatif (AsyncLocalStorage) et par base.
- **Problèmes opérationnels** : latence importante pour Annemasse ; indisponibilité totale lorsque la connexion (Wi-Fi/box) du siège tombe ; point de défaillance unique.
- **Faits confirmés par l'équipe** : base de prod sur le Mac mini ; Sentry et DocuSeal annoncés en UE ; disque non chiffré ; pas de copie externe des sauvegardes.

---

## 3. Non-conformités constatées

Légende gravité : **Critique** (risque immédiat de perte/fuite) · **Élevée** · **Moyenne**.

### Synthèse

| # | Gravité | Sujet | Standard |
|---|---|---|---|
| 1 | Critique | Sauvegardes incomplètes, en clair, sans copie externe | Art. 32, S4 |
| 2 | Critique | Aucun chiffrement au repos | Art. 32, S2 |
| 3 | Critique | Exposition Internet depuis une box, config proxy non versionnée | Art. 32, S5, S13 |
| 4 | Critique | Observabilité (Jaeger/OTLP) exposée en prod | Art. 25, 32, S5 |
| 5 | Critique | Pas de registre, DPA, DPIA ; transfert Anthropic non qualifié | Art. 28, 30, 35, 44 |
| 6 | Élevée | Droits des personnes non implémentés | Art. 15-22 |
| 7 | Élevée | Pas de purge / rétention effective | Art. 5-1-e |
| 8 | Élevée | Consentement non appliqué (`warn`) | Art. 6-7, 25 |
| 9 | Élevée | Sentry front : replay + PII par défaut | Art. 5-1-c, 25 |
| 10 | Élevée | DocuSeal : défaut code hors UE | Art. 44 |
| 11 | Élevée | Sous-traitants non déclarés / inexacts dans la politique | Art. 13, 28 |
| 12 | Élevée | `veille/` : données et clés suivies par git | Art. 32, S9 |
| 13 | Élevée | Isolation des tenants faible | Art. 25, 32, S6 |
| 14 | Moyenne | Mongo root + sans TLS ; MySQL TLS non imposé | Art. 32, S3, S6 |
| 15 | Moyenne | Logs sans rotation ni rétention, pas de journal d'accès lecture | Art. 5-1-e, 33, S7 |
| 16 | Moyenne | Pas d'en-têtes de sécurité nginx ; conteneurs non durcis | S10, S11 |
| 17 | Moyenne | Secrets en `.env`, pas de scan en CI | S9, S10 |
| 18 | Moyenne | Rate-limit en mémoire ; flag E2E à vérifier | S5 |
| 19 | Moyenne | Mentions légales / placeholders non remplis | Art. 13 |
| 20 | Moyenne | Documentation contradictoire (Atlas/TiDB) | Art. 30 |

### Détail

#### 1. Sauvegardes — Critique
- **Constat**
  - `scripts/backup-db.sh` ne sauvegarde que `disciplina` (MySQL, l. 239) et `human_ressources` (Mongo, l. 245). **`disciplina_annemasse` n'est jamais sauvegardé** (MySQL et Mongo). `scripts/rollback.sh` ne le restaure pas non plus.
  - Dumps en clair (`.sql`, `.archive`), écrits dans `<repo>/backups/` sur le **même disque** que les DB. Rétention 7 jours (`find -mtime +7 -delete`). Aucune copie hors machine (reconnu dans `HOWTODEPLOY.md:48-49`, `README.md:68`, BACKLOG DB-5).
  - Aucun test de restauration, checksum ou alerte d'échec.
  - Mots de passe passés en argument (`-p"$MYSQL_ROOT_PASSWORD"` l. 239, `--password` l. 244 — now `scripts/backup*.sh`, `rollback.sh`; fixed in #1112 via `MYSQL_PWD` + `scripts/mongo-exec.sh`) : visibles dans la liste des processus.
  - Pas de `umask`/`chmod` : permissions par défaut.
  - Le Mac mini peut se mettre en veille à 03:00 (`README.md:177`), retardant ou manquant la sauvegarde.
- **Risque** : panne disque, vol, ransomware ou erreur = perte définitive des données Annemasse ; fuite complète si le disque est volé.
- **Correctif** : couvrir les deux tenants ; chiffrer (age/restic) ; copie hors site chez un second fournisseur UE ; `MYSQL_PWD`/fichier d'options ; `umask 077` ; test de restauration planifié ; alerte d'échec.

#### 2. Chiffrement au repos — Critique
- **Constat** : disque du Mac mini non chiffré (FileVault inactif, confirmé). Données MySQL/Mongo en bind mounts (`docker-compose.yaml:16`, `./database/mongodb/mongo-data`). Chiffrement applicatif limité au NIR (AES-256-GCM, `external/crypto/ssn-cipher.ts` ; sel scrypt codé en dur `'ssn-salt'`, SSN en clair legacy toléré) et aux tokens Google (`token-cipher.ts`). Handicap (`psh_*`, `special_needs`), contact d'urgence, avatars (Buffer Mongo) et `mcp_oauth_clients.client_secret` en clair.
- **Risque** : vol ou récupération du matériel = accès à toutes les données personnelles, dont données sensibles.
- **Correctif** : chiffrement disque (FileVault maintenant, LUKS sur la cible) ; envisager le chiffrement de champs pour les données de santé ; sel unique par déploiement pour le NIR ; migrer les NIR en clair.

#### 3. Exposition Internet — Critique
- **Constat** : service publié via redirection de ports de la box. Caddy tourne sur l'hôte, sa configuration n'est pas versionnée (seul un extrait dans `HOWTODEPLOY.md:165-176`) : TLS, en-têtes et logs d'accès non auditables. Aucun pare-feu, VPN, Tailscale ou tunnel documenté. Accès SSH opérateur non documenté.
- **Risque** : surface d'attaque directe sur une machine de bureau, sans durcissement vérifiable.
- **Correctif** : versionner le Caddyfile ; pare-feu deny-by-default ; SSH par clé uniquement via VPN ; à terme, hébergement en datacenter.

#### 4. Observabilité exposée — Critique
- **Constat** : `docker-compose.prod.yaml` réinitialise les ports MySQL/Mongo mais **pas** `jaeger` (16686 UI sans authentification, 4317) ni `otel-collector` (4318, `docker-compose.yaml:173,181-183`) : ils restent liés à 0.0.0.0 si le déploiement fusionne les deux fichiers (`HOWTODEPLOY.md:57-58`). Les traces contiennent chemins HTTP et `user.id` ; échantillonnage `always_on` ; l'exporter `debug` du collector (`otel-collector.yaml:12-13`, `verbosity: detailed`) écrit les traces complètes dans les logs conteneur.
- **Correctif** : `ports: !reset []` (ou 127.0.0.1) pour jaeger/otel en prod ; retirer l'exporter `debug` ; échantillonnage réduit ; authentification ou accès par tunnel pour l'UI.

#### 5. Registre, DPA, DPIA, transferts — Critique
- **Constat** : pas de registre général des traitements (`rgpd/README.md:50-53`, F3) ; DPAs « à archiver » pour Google, Sentry, DocuSeal, ClassMarker (`rgpd/README.md:38-41`), aucun dossier `rgpd/dpas/` ; pas de DPIA. MCP vers Anthropic : DPA non signé, transfert hors UE « à qualifier », DPIA non réalisée (`rgpd/registre-mcp.md`, `MCP_RGPD_AUDIT.md` M1). Le consentement `ai_processing` ne couvre pas un LLM tiers (rédaction « résumé IA local »).
- **Correctif** : registre Art. 30 complet ; archiver les DPAs ; DPIA (IA, données sensibles, NIR) ; analyse du transfert (CCT + TIA) ou désactivation de MCP tant que non réglé.

#### 6. Droits des personnes — Élevée
- **Constat** : aucun endpoint d'export/portabilité, rectification, opposition ou retrait de consentement pour les candidats (`RGPD.md` F4, `:222-290`). L'effacement se fait uniquement par un employé RH (`deleteCandidate`, `graphql/candidate/resolver.ts:408`). Aucun journal montrant à un candidat qui a consulté ses données (F14).
- **Correctif** : procédure documentée (délai 1 mois) + endpoints/outils internes ; inclure les copies (Drive, Filiz, DocuSeal) et la gestion des sauvegardes.

#### 7. Rétention et purge — Élevée
- **Constat** : purges existantes limitées : `external_access`, `refresh_tokens` (J+7), `mcp_audit_log` (365 j), `peda_draft_history.recipient` (365 j), notifications (TTL 48 h), tentatives de questionnaire non démarrées. **Aucune purge** pour candidats (par statut/âge), `candidateHistory`, alternants, ruptures, entreprises, `contact_logs`, `relance_history`, KPI `user_name`. Pas de cascade vers Drive, Filiz, DocuSeal ni la collection d'avatars. La politique de confidentialité indique la purge auto « en cours » (`politique-confidentialite.md`). Politique cible : `database/DATA_CLASSIFICATION.md:28-88`.
- **Correctif** : jobs de purge/anonymisation alignés sur `DATA_CLASSIFICATION.md` ; cascade vers tiers ; durée de vie des sauvegardes cohérente avec les durées de conservation.

#### 8. Consentement — Élevée
- **Constat** : `assertConsent` en mode `warn` partout (`rest/candidates/route.ts:318,524,600,674,717`, `FilizFolderService.ts:149`) ; seul MCP applique strictement le consentement. Bandeau cookies informatif seulement (`CookieBanner.tsx:8-12`) : Sentry démarre sans consentement. Pas d'historique de consentement (seulement la dernière date/version), pas de retrait. Aucun consentement/information pour alternants, formateurs, contacts entreprise.
- **Correctif** : passer en `block` ; historiser ; mécanisme de retrait ; bannière avec choix réel.

#### 9. Sentry front — Élevée
- **Constat** : `front/disciplina-front/src/main.tsx:15-40` : replay 10 % des sessions et 100 % sur erreur, `userInfo`/`httpBodies` par défaut (lignes d'opt-out commentées l. 21-24), `debug: true`, `enableLogs: true`, masquage non explicite. Variables `VITE_SENTRY_*` obligatoires : Sentry toujours actif. Région du DSN non épinglée dans le code (la politique annonce l'Allemagne, `RGPD.md:432` mentionne US/Allemagne).
- **Correctif** : `sendDefaultPii: false`, `maskAllText`/`blockAllMedia`, replay désactivé ou conditionné au consentement ; vérifier que le DSN prod est en UE (`*.de.sentry.io`).

#### 10. DocuSeal — Élevée
- **Constat** : défaut du code `https://api.docuseal.com` (US) et URL de signature `docuseal.com` (`back/src/config/env.ts:209,212`) ; l'UE n'est qu'un commentaire. L'équipe indique l'UE en prod mais aucune preuve dans le dépôt.
- **Correctif** : défaut UE (`docuseal.eu`) dans `env.ts` ; vérifier le `.env` de prod ; DPA.

#### 11. Sous-traitants non déclarés — Élevée
- **Constat** : la politique (`front/disciplina-front/src/content/legal/politique-confidentialite.md:116-128`) liste Brevo (non utilisé : l'e-mail passe par Gmail OAuth, `back/README.md:261`) et omet : Yousign, Filiz, DuckDuckGo (`external/ddg`, requêtes générées par LLM avec nom/adresse d'entreprise), Anthropic (MCP), Mistral/OpenAI (workflows n8n `veille*.json`), Google Fonts (`index.css:1`, transfert IP/UA vers Google). Google : « UE avec accès possible hors UE » vs `RGPD.md:429-437` « US ». ClassMarker : hors UE, intégration encore active.
- **Correctif** : tableau des sous-traitants exact (rôle, données, pays, DPA) ; auto-héberger les polices ; décider du sort des workflows n8n LLM.

#### 12. `veille/` — Élevée
- **Constat** : `veille/n8n/data` (`config` avec `encryptionKey`, `database.sqlite` avec credentials chiffrés, logs) et `veille/rss/data` (`config.php`, clé Fever, `users/epitech/config.php`, `db.sqlite`) sont suivis par git alors que `veille/n8n/data/.gitignore` indique `data/*`. Le workflow `suivi-abs-peda.json` traite noms/prénoms/e-mails d'élèves (Google Sheets → brouillons Gmail) hors registre ; `veille.json` / `veille-mensuelle.json` envoient le contenu de mails à Mistral/OpenAI sans DPA.
- **Correctif** : `git rm --cached`, rotation de toutes les clés/credentials concernés (l'historique git reste exposé), inscription au registre ou suppression.

#### 13. Isolation des tenants — Élevée
- **Constat** : un seul hôte, une seule instance MySQL et une instance Mongo ; l'application se connecte à Mongo en **root** (`back/src/db/mongo/connection.ts:7-15`) et l'URI Annemasse retombe sur les identifiants root si `MONGO_ANNEMASSE_USERNAME` est absent ; `disciplina_app` a les mêmes droits sur les deux bases MySQL (`mysql-init.sql:612-618`). La séparation repose sur le code (`db/tenant.ts`, AsyncLocalStorage).
- **Risque** : un bug de routage de tenant ou une injection expose les deux sites.
- **Correctif** : comptes DB distincts par tenant avec droits limités à leur base ; utilisateur Mongo applicatif non-root ; à terme, instances ou hôtes séparés.

#### 14. Bases de données — Moyenne
- Mongo sans TLS ni utilisateur à moindre privilège (`mongo-init.js` ne crée aucun utilisateur applicatif).
- MySQL : pas de `REQUIRE SSL` ni `require_secure_transport` ; TLS côté client uniquement (`MYSQL_SSL_CA`), certificat auto-signé sans vérification d'hôte (`db/mysql/connection.ts:9-22`) ; compte `@'%'` ; `mysql-init.sql` ne s'exécute que sur volume neuf.
- Les scripts `startup-script`, `backup-db.sh`, `rollback.sh` utilisent root.

#### 15. Logs — Moyenne
- Logs Docker `json-file` sans rotation ni rétention (aucun `logging:` dans les compose) : croissance illimitée et conservation indéfinie de données personnelles potentielles.
- Pino : `redact` limité à la racine et deux niveaux (`external/logger/logger.ts:41-87`), stacks d'erreur pouvant contenir des PII.
- Pas de journal d'accès en lecture aux dossiers candidats ni de trace des exports / `unmaskCandidateSsn` (F14), ce qui complique la détection d'une violation (Art. 33).
- `deploy.sh:241` affiche les lignes d'erreur des logs dans le terminal.

#### 16. Durcissement web et conteneurs — Moyenne
- `front/disciplina-front/nginx.conf` : HTTP port 80, aucun en-tête de sécurité (CSP/HSTS/X-Frame-Options uniquement sur l'API via Helmet, `back/src/index.ts:83-110`, et seulement en production).
- Conteneurs : nginx et scripts en root, images `:latest` ou non pinées (ollama, otel-collector, jaeger, `node:alpine`, `nginx:alpine`), pas de `read_only`/`cap_drop`/`no-new-privileges`, pas de limites de ressources ni de healthchecks.

#### 17. Secrets et CI — Moyenne
- Secrets dans des fichiers `.env` et variables d'environnement, aucun gestionnaire de secrets / Docker secrets. `RGPD.md` F11 signale des secrets dans le dépôt (valeurs non relues dans cet audit).
- La CI (`.github/workflows/ci.yml`) n'exécute pas lint/build frontend, ni scan de secrets, ni scan d'images, ni SAST ; Dependabot ne couvre pas Docker ; actions pinées par tag, pas par SHA.

#### 18. Rate-limit — Moyenne
- Limiteurs en mémoire (`rest/middleware/rateLimiter.ts`) : compteurs perdus au redémarrage ; `E2E_DISABLE_LOGIN_RATE_LIMIT` désactive la limitation de login : **vérifier qu'il n'est pas défini en prod**.

#### 19. Documents légaux — Moyenne
- `front/disciplina-front/src/content/legal/mentions-legales.md:40` : hébergeur = « Disciplina Réunion, auto-hébergement (Mac mini + Docker) » ; ne mentionne pas Annemasse ; placeholders `[[NOM_ORGANISME]]` et `[[EMAIL_DPO]]` non remplis (`_placeholders.md`). À mettre à jour après migration.

#### 20. Documentation contradictoire — Moyenne
- `AUDIT_DEPS.md:145` indique que le `.env` racine pointe vers Atlas/TiDB ; `env.ts:146` et `db/mysql/connection.ts:9-11` citent TiDB Cloud ; `back/vercel.json` existe. L'équipe confirme que la prod est sur le Mac mini : nettoyer ou lever l'ambiguïté (si une base cloud a existé, vérifier qu'elle est purgée).

---

## 4. Points à vérifier côté production (hors repo)

- [ ] Configuration Caddy réelle : TLS, HSTS, en-têtes, journaux d'accès, versions.
- [ ] Redirections de ports de la box : lesquels sont ouverts (attendu : 80/443 uniquement) ; `nmap` externe.
- [ ] Les ports 16686, 4317, 4318 sont-ils joignables depuis Internet ?
- [ ] Accès SSH : méthode, clés, IP autorisées.
- [ ] DSN Sentry prod : région UE ?
- [ ] `DOCUSEAL_BASE_URL` / `DOCUSEAL_SIGN_URL` en prod : endpoints UE ?
- [ ] `E2E_DISABLE_LOGIN_RATE_LIMIT` absent du `.env` prod.
- [ ] FileVault : activation et conservation de la clé de récupération.
- [ ] Où est réellement écrit `backups/` ; le Mac mini est-il en veille la nuit ?
- [ ] Une base cloud (Atlas/TiDB) a-t-elle déjà contenu des données de prod ?
- [ ] Existence de contrats / DPAs déjà signés non archivés dans `rgpd/dpas/`.
- [ ] Qui a accès physique et logique au Mac mini ?

---

## 5. Exigences pour l'architecture cible

- **Hébergeur** : UE (de préférence France), DPA signé, ISO 27001 ; SecNumCloud apprécié ; HDS à trancher.
- **Un site unique** pour les deux tenants : la latence La Réunion ↔ métropole (≈ 150 ms) est acceptable pour une application web et supprime la dépendance au réseau du siège ; Annemasse gagne nettement.
- **Machine** : le dédié évoqué (EPYC 4545P, 64 Go, 2×4 To NVMe) est largement suffisant ; un VPS/dédié plus petit suffirait (le point de vigilance est Ollama sur CPU). Disques en RAID1 + chiffrement LUKS.
- **Réseau** : pare-feu deny-by-default ; seuls 80/443 publics ; SSH par clé via VPN ; DB, Jaeger, OTLP, Ollama jamais exposés.
- **Isolation tenants** : identifiants DB distincts, utilisateur Mongo non-root, TLS interne ou socket local.
- **Sauvegardes 3-2-1** : chiffrées, hors site chez un autre fournisseur UE, couvrant les deux tenants, restauration testée, alerte d'échec.
- **Disponibilité** : supervision externe (uptime), snapshots, PRA documenté avec RPO/RTO ; le Mac mini devient au plus un poste de secours/dev.
- **Observabilité** : logs avec rotation et rétention, sans PII superflue ; traces en échantillonnage réduit.
- **Migration** : dump chiffré → restauration → bascule DNS (`app.reunion.disciplina.re` + domaine Annemasse) → effacement sécurisé du Mac mini → mise à jour mentions légales, registre, `HOWTODEPLOY.md`.

---

## 6. Plan d'actions

### Immédiat (sans attendre la migration)
1. Activer FileVault sur le Mac mini.
2. Corriger `scripts/backup-db.sh` : deux tenants, `MYSQL_PWD`, `umask 077`, chiffrement, copie hors site, alerte d'échec ; faire un premier test de restauration.
3. `docker-compose.prod.yaml` : reset des ports jaeger/otel-collector ; retirer l'exporter `debug`.
4. Vérifier les points de la section 4 (DocuSeal/Sentry UE, ports ouverts, rate-limit).
5. Sortir `veille/*/data` de git et faire tourner les secrets concernés.

### Documentation
6. Registre Art. 30 (candidats, alternants, entreprises, MCP, péda).
7. Tableau exact des sous-traitants ; archiver les DPAs (Google, Sentry, DocuSeal, Yousign, Filiz, Anthropic, ClassMarker) dans `rgpd/dpas/`.
8. DPIA (IA/MCP, NIR, données de santé) et analyse de transfert Anthropic.
9. Mise à jour de la politique de confidentialité et des mentions légales.

### Code
10. Endpoints/outils pour les droits (export, rectification, retrait de consentement).
11. Jobs de purge/anonymisation selon `database/DATA_CLASSIFICATION.md`, avec cascade vers les tiers.
12. `assertConsent` en `block` ; Sentry derrière consentement et sans PII ; polices auto-hébergées.
13. Comptes DB par tenant, utilisateur Mongo applicatif, TLS imposé.

### Migration
14. Choix de l'hébergeur UE, durcissement (LUKS, pare-feu, Caddy versionné), bascule planifiée, décommissionnement du Mac mini.

### Vérification
- `docker compose -f docker-compose.yaml -f docker-compose.prod.yaml config` : aucun port 0.0.0.0 hors reverse proxy.
- Sauvegarde : dumps chiffrés des deux tenants + copie externe, restauration sur une instance de test.
- `nmap` externe : seuls 80/443 ouverts.
- `fdesetup status` (FileVault) / `cryptsetup status` (LUKS).
- `/verify-backend`, `/verify-frontend` pour tout changement de code ; `/security-review` avant merge.

---

## Limites de cet audit

- Les fichiers `.env.example` et `back/.env.back.example` n'ont pas été lus (accès refusé) ; les noms de variables viennent de `back/src/config/env.ts` et des compose.
- Aucun secret n'a été lu ; la présence de secrets dans le dépôt (F11, `veille/`) est signalée d'après les noms de fichiers.
- La configuration Caddy, la box et le Mac mini n'ont pas été inspectés directement.
- Les durées de purge n'ont pas été comparées au registre (inexistant).
