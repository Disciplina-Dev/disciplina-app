# Registre des activités de traitement (Art. 30 RGPD)

> **Brouillon à valider par le DPO.** Ce registre n'est pas un avis juridique. Il est établi à partir de
> l'audit [`INFRA_RGPD_AUDIT.md`](../INFRA_RGPD_AUDIT.md) (2026-11-10), du code (état au 2026-11-19) et du
> corpus légal publié ([`politique-confidentialite.md`](../front/disciplina-front/src/content/legal/politique-confidentialite.md)).
> Toute information non vérifiable dans le code est marquée **À confirmer** ; toute durée non
> implémentée est marquée **Non appliquée** (la politique de confidentialité la promet, le code ne la met pas en œuvre).
>
> Dernière mise à jour : 2026-11-19 · Statut : **en attente de relecture DPO** (critère d'acceptation GDPR_INF_05.1).

## 1. Responsable de traitement et DPO

| Champ | Contenu |
|---|---|
| Responsable de traitement | Disciplina Reunion (SARL) — SIRET 978 289 866 00011 — 71 rue Roger Payet, 97438 Sainte-Marie |
| DPO / référente RGPD | Séverine DUGAIN — contact@disciplina.re — 0693 88 80 21 |
| Périmètre | Application Disciplina (back Node/TS, front React, MySQL, MongoDB) pour les sites de La Réunion et d'Annemasse (deux bases, mêmes traitements) |
| Registre MCP | [`registre-mcp.md`](registre-mcp.md) (fiche détaillée, non dupliquée ici) |

## 2. Vue d'ensemble

| # | Traitement | Base légale | Sous-traitants / destinataires | Transfert hors UE | Statut |
|---|---|---|---|---|---|
| T1 | Candidats | Mesures précontractuelles / contrat (6.1.b) ; consentements par finalité (6.1.a) | Google, entreprises partenaires, Ollama (local) | Google : à qualifier | Ouvert |
| T2 | Alternants (suivi péda) | Contrat / mission de formation (6.1.b) ; intérêt légitime (6.1.f) | Filiz, Google | Filiz : **À confirmer** | Ouvert |
| T3 | Entreprises et contacts | Intérêt légitime (6.1.f) | Entreprises (portail externe), Google, INSEE/entreprises (données publiques) | Google : à qualifier | Ouvert |
| T4 | Assistance LLM via MCP | Intérêt légitime (6.1.f) ; consentement `ai_processing` | Anthropic | **Oui, non qualifié** | Ouvert (05.3, 05.4, 05.5) |
| T5 | Questionnaires d'évaluation | Mesures précontractuelles (6.1.b) | Google Drive (PDF) ; ClassMarker en transition | ClassMarker : hors UE | Ouvert |
| T6 | Signature électronique | Contrat (6.1.b) | DocuSeal | DocuSeal : hors UE | Ouvert |
| T7 | Comptes utilisateurs et authentification | Intérêt légitime (6.1.f) / contrat de travail | Google (OAuth) | Google : à qualifier | Conforme sous réserve |
| T8 | Supervision technique et journaux | Intérêt légitime (6.1.f) ; consentement pour les replays | Sentry | UE (Allemagne), à confirmer côté DSN de prod | Ouvert |
| T9 | Messagerie, relances et agenda | Contrat / intérêt légitime | Google (Gmail, Calendar) | Google : à qualifier | Ouvert |

## 3. Fiches de traitement

### T1 — Candidats (CRM, accompagnement, mise en relation)

| Champ | Contenu |
|---|---|
| Finalité | Accueillir, évaluer et accompagner les candidats à l'alternance ; les mettre en relation avec des entreprises partenaires |
| Base légale | 6.1.b (mesures précontractuelles) ; consentements distincts enregistrés par candidat : `data_processing` (obligatoire), `data_sharing` (partage entreprises), `ai_processing` (résumé IA), `photo_processing` (photo), avec date et version du corpus légal (`back/src/types/candidate.types.ts`) |
| Personnes concernées | Candidats, dont des **mineurs** (indicateur « mineur » présent dans l'application) |
| Catégories de données | Identité (nom, e-mail, téléphone, date et lieu de naissance, sexe, adresse), parcours (formation, expériences, compétences, projet), CV et photo (Google Drive), synthèse recruteur, suivi RH (historique), relances. **Données sensibles** : numéro de sécurité sociale (NIR), situation de handicap (`psh_*`), besoins spécifiques, contact d'urgence, situation France Travail / Mission Locale |
| Origine | Saisie par les RH, import CSV, formulaire |
| Destinataires | Salariés habilités (RBAC par rôle) ; entreprises partenaires pour les profils partagés avec consentement `data_sharing` (responsables de traitement distincts) |
| Sous-traitants | Google Drive/Gmail ; Ollama (local, aucun transfert) ; Anthropic via MCP (voir T4) |
| Transferts hors UE | Google : traitement possible hors UE, **à qualifier** (voir 05.4 pour MCP) |
| Durées | Politique : candidat accompagné = accompagnement + 3 ans après dernier contact ; sans suite = 1 an ; photo = accompagnement ou retrait du consentement ; NIR = durée de la formalité. **Non appliquée** : aucune purge automatique des candidats n'existe dans le code (seule la suppression manuelle `deleteCandidate`, rôle RH). À décider avec le DPO |
| Mesures de sécurité | NIR chiffré AES-256-GCM, clés versionnées et rotation (`external/crypto/ssn-cipher.ts`) ; santé/handicap/contact d'urgence chiffrés AES-256-GCM (`health-cipher.ts`, GDPR_INF_02.3) ; RBAC (`authGuardRole`) ; contrôle du consentement (`consentGuard.ts`) ; TLS MySQL en production (`MYSQL_SSL_CA`) ; compte applicatif MySQL à droits limités ; bases sans port public (#1124) |
| Droits | Accès, rectification, suppression : voir `RGPD.md` faille 4. Procédure de réponse : **À documenter** |
| Points ouverts | DPA Google (05.2) ; AIPD (05.3) car données sensibles + mineurs ; purge automatique à implémenter |

### T2 — Alternants (suivi pédagogique)

| Champ | Contenu |
|---|---|
| Finalité | Suivre les alternants en cours de formation : sessions, séquences d'accompagnement, ruptures, dossier Filiz, brouillons de mails péda |
| Base légale | 6.1.b / mission de formation ; 6.1.f pour le suivi interne |
| Personnes concernées | Alternants ; tuteurs/mentors cités ; entreprises d'accueil |
| Catégories de données | Prénom, nom, e-mail, téléphone, session, entreprise, dates de contrat, séquences (contacts mentor/alternant/formateur), rupture et motif, dossier Filiz (étape, dates), historique des brouillons (`peda_draft_history`) |
| Destinataires | Rôles PEDA et RESPONSABLE+ |
| Sous-traitants | Filiz (synchronisation `FilizSyncService`) ; Google (Gmail pour les brouillons) |
| Transferts hors UE | Filiz : **À confirmer** |
| Durées | Destinataires des brouillons anonymisés après 365 j (`pedaDraftScheduler.ts`, `RECIPIENT_RETENTION_DAYS`). Alternant, séquences, ruptures : **Non appliquée** (aucune durée dans le code ; à décider) |
| Mesures de sécurité | RBAC PEDA ; miroir Filiz local (`filiz` : cache avec `expires_at`, purge dans `FilizRepository`) ; mesures générales de T1 |
| Exposition MCP | Voir T4 et la section « Périmètre péda » de [`registre-mcp.md`](registre-mcp.md) |
| Points ouverts | Durée de conservation des alternants et ruptures ; DPA Filiz (05.2) |

### T3 — Entreprises et contacts

| Champ | Contenu |
|---|---|
| Finalité | Prospection, suivi des relations, analyses du besoin (AB), offres, mise en relation, détection de conflits |
| Base légale | 6.1.f (prospection B2B, information préalable et droit d'opposition) |
| Personnes concernées | Contacts d'entreprise (dirigeants, RH, tuteurs) ; salariés de Disciplina rattachés |
| Catégories de données | Raison sociale, SIRET, adresse, contacts nominatifs (nom, e-mail, téléphone, poste), journal de contacts (`contact_logs`), historique (`company_history`), liste noire, conflits, analyses du besoin et offres (MongoDB `needs_analysis`) |
| Destinataires | Salariés habilités ; entreprises via portail externe (`external_access`, liens signés à durée limitée, code à 6 chiffres, 6 statuts) |
| Sous-traitants | Google ; sources publiques INSEE/Sirene, annuaire des entreprises, DuckDuckGo et scraper (données publiques en entrée) |
| Transferts hors UE | Google : à qualifier |
| Durées | Politique : 3 ans après dernier contact ; offre : 1 an après clôture. **Non appliquée** (aucune purge). Accès externes expirés : supprimés +7 j (`expiredAccessScheduler.ts`, `GRACE_DAYS`) |
| Mesures de sécurité | RBAC ; accès externes à usage limité (expiration, tentatives, verrouillage `LOCKED`) ; TLS MySQL ; bases non exposées |
| Points ouverts | Mentions d'information B2B ; purge automatique |

### T4 — Assistance LLM via MCP

Voir la fiche complète [`registre-mcp.md`](registre-mcp.md). Synthèse :

| Champ | Contenu |
|---|---|
| Finalité | Consultation du CRM par un assistant LLM (`POST /api/mcp`, outils en lecture seule) |
| Destinataires | Anthropic (éditeur du client LLM) |
| Données | Liste blanche champ par champ (`candidateExposure.ts`, `pedaExposure.ts`) : « Prénom N. », pas de coordonnées ni de données sensibles |
| Transfert hors UE | **Non qualifié** (CCT / TIA à réaliser, 05.4) |
| Durées | Journal d'accès `mcp_audit_log` 365 j ; refresh tokens OAuth 30 j (+7 j de grâce) ; clients OAuth inactifs 90 j (`expiredAccessScheduler.ts`, `mcp/auditStore.ts`) |
| Mesures | OAuth 2.1 + PKCE, secrets chiffrés, quotas, pagination, journal sans PII |
| Points ouverts | DPA Anthropic (05.2) ; AIPD (05.3) ; libellé du consentement `ai_processing` (« IA locale » ne couvre pas un LLM tiers, 05.5) |

### T5 — Questionnaires d'évaluation

| Champ | Contenu |
|---|---|
| Finalité | Évaluer le positionnement des candidats (questionnaires internes, #968, en remplacement de ClassMarker) |
| Base légale | 6.1.b (mesures précontractuelles) |
| Catégories de données | Réponses, score, durée, nombre de sorties d'onglet ; identité lue depuis la fiche (non ressaisie) |
| Destinataires | RH ; PDF déposé sur le Drive du candidat |
| Sous-traitants | Google Drive ; ClassMarker pendant la transition (résultats, identifiant candidat) |
| Transferts hors UE | ClassMarker : hors UE, **non encadré à ce jour** |
| Durées | Conservés avec la fiche candidat, supprimés avec elle (`deleteAttemptsByCandidate`) ; invitation non utilisée purgée à expiration (15 min par défaut) |
| Mesures | Liens à durée limitée ; accès RH uniquement ; non exposé au MCP (réponses et scores exclus) |
| Points ouverts | Date de retrait de ClassMarker ; DPA ClassMarker tant qu'il reste actif |

### T6 — Signature électronique

| Champ | Contenu |
|---|---|
| Finalité | Faire signer les analyses du besoin (AB) et documents associés |
| Base légale | 6.1.b |
| Données | Nom, e-mail, signature, PDF d'analyse du besoin |
| Sous-traitants | DocuSeal (hors UE), seul prestataire de signature utilisé (confirmé par l’équipe projet ; le code `external/yousign` n’est pas utilisé en production) |
| Durées | Politique : 5 ans (archivage). **Non appliquée** côté application ; durée chez le prestataire : **À confirmer** |
| Mesures | Webhook protégé (`rest/docuseal/route.ts`) ; relances planifiées (`abSignatureRelanceScheduler.ts`) |
| Points ouverts | DPA + localisation DocuSeal (05.2) |

### T7 — Comptes utilisateurs et authentification

| Champ | Contenu |
|---|---|
| Finalité | Authentifier et habiliter les salariés ; connecter Google (Drive, Gmail, Agenda) |
| Base légale | 6.1.f / exécution du contrat de travail |
| Personnes concernées | Salariés et utilisateurs internes |
| Données | Nom, e-mail, mot de passe haché, rôle, secteurs, jetons OAuth Google (chiffrés, `token-cipher.ts`), `refresh_tokens`, préférences (todos, signatures, modèles) |
| Durées | Refresh tokens : TTL 30 j, purge +7 j. Suppression d'un compte : soft delete (`is_deleted`) avec purge des données strictement personnelles et réaffectation des relations (`UserDeletionService`). Historiques conservés (preuve) |
| Mesures | JWT court (15 min), rotation et détection de réutilisation des refresh tokens, limitation des tentatives de connexion, RBAC |
| Points ouverts | Durée de conservation de la ligne `users` supprimée logiquement |

### T8 — Supervision technique et journaux

| Champ | Contenu |
|---|---|
| Finalité | Détection d'erreurs, performances, sécurité |
| Base légale | 6.1.f ; consentement pour les enregistrements de session (bannière cookies) |
| Données | Journaux applicatifs (`logger`, sans `console.*`), erreurs et replays Sentry, traces OpenTelemetry/Jaeger (échantillonnage 10 % en production, valeurs GraphQL non tracées, UI Jaeger sur boucle locale, #1124-#1126) |
| Sous-traitants | Sentry (instance allemande selon la politique ; DSN de production **À confirmer**) |
| Durées | Sentry : 30 j selon la politique, réglage côté compte **À confirmer**. Jaeger all-in-one : stockage en mémoire, perdu au redémarrage (**À confirmer**). Journaux Docker : **À confirmer** |
| Mesures | Replays Sentry échantillonnés (session 10 % par défaut, 100 % sur erreur, `front/.../main.tsx`) ; aucun masquage explicite (`maskAllText`, etc.) trouvé dans la configuration : **À confirmer** (défauts du SDK) ; échantillonnage des traces réduit ; ports d'observabilité non publiés |

### T9 — Messagerie, relances et agenda

| Champ | Contenu |
|---|---|
| Finalité | Envoi de mails (invitations, relances, propositions), prise de rendez-vous, agenda |
| Base légale | 6.1.b / 6.1.f |
| Données | Adresses e-mail, contenu des messages, rendez-vous, historique des relances (`relance_history`) |
| Sous-traitants | Google (Gmail, Calendar) via OAuth de l’utilisateur. Brevo n’est pas utilisé (confirmé) : à retirer de la politique de confidentialité |
| Durées | Politique : 3 ans. **Non appliquée** (aucune purge de `relance_history`) |
| Mesures | Contenu HTML assaini (`sanitizeMailHtml.ts`) ; liens signés par HMAC (`RELANCE_HMAC_SECRET`) |

## 4. Mesures de sécurité transverses (Art. 32)

- Chiffrement applicatif des données sensibles (NIR, santé) avec rotation de clé ; secrets en variables d'environnement.
- TLS obligatoire vers MySQL en production ; compte applicatif `disciplina_app` à droits limités.
- Bases MySQL/MongoDB sans port publié en production ; Ollama, Jaeger sur boucle locale ; collector OTel non exposé.
- Contrôle d'accès par rôle (RBAC) et rate limiting de la connexion.
- Hébergement : serveur auto-hébergé (Mac mini) — sauvegarde, restauration et sécurité physique en cours de traitement (voir [`INFRA_MIGRATION_STUDY.md`](../INFRA_MIGRATION_STUDY.md), `HOWTODEPLOY.md`). Si migration vers un hébergeur UE : DPA à archiver.

## 5. Sous-traitants et transferts (synthèse)

| Sous-traitant | Traitements | Localisation (politique) | DPA | Suivi |
|---|---|---|---|---|
| Google (Drive, Gmail, Calendar) | T1, T3, T5, T7, T9 | UE, accès hors UE possible | À archiver | 05.2 |
| Sentry | T8 | UE (Allemagne) | À archiver | 05.2 |
| DocuSeal | T6 | Hors UE | À archiver | 05.2 |
| Filiz | T2 | À confirmer | À confirmer | 05.2 |
| ClassMarker | T5 (transition) | Hors UE | À archiver | 05.2 |
| Anthropic | T4 | Hors UE | Non signé | 05.2, 05.4 |
| Ollama | T1 (résumé IA) | Local, aucun transfert | Sans objet | — |

## 6. Points ouverts consolidés

1. Relecture et validation par le DPO (critère d'acceptation).
2. Compléter l’adresse et vérifier la dénomination sociale exacte du responsable de traitement (Kbis).
3. Durées non appliquées : candidats, alternants, entreprises, offres, relances, documents signés — décider puis implémenter des purges ; sinon corriger la politique de confidentialité.
2. Faire valider l’identité du responsable de traitement (dénomination, adresse, SIRET) par le DPO, au regard du Kbis.
5. DPA (05.2), AIPD (05.3), transfert Anthropic (05.4), libellé du consentement IA (05.5).
6. Procédure de gestion des demandes d'exercice des droits.
7. Tenir ce registre à jour à chaque nouveau traitement ou sous-traitant (règle d'équipe à décider avec le DPO).
