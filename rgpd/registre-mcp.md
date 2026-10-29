# Fiche de registre — Assistance LLM via MCP (Art. 30)

> Brouillon à valider par le DPO / responsable de traitement. Voir [`MCP_RGPD_AUDIT.md`](../MCP_RGPD_AUDIT.md).

| Champ | Contenu |
|---|---|
| Traitement | Consultation du CRM Disciplina par un assistant LLM (serveur MCP, `POST /api/mcp`) |
| Responsable | Centre de formation (Disciplina) |
| Finalité | Aider les salariés à rechercher et synthétiser les fiches candidats / entreprises / offres / KPI, et à suivre l'avancement pédagogique (sessions, séquences d'accompagnement, ruptures) |
| Base légale | Intérêt légitime (Art. 6.1.f) ; candidats : consentement `ai_processing` requis |
| Personnes concernées | Candidats, alternants, contacts entreprise, salariés utilisateurs |
| Catégories de données | Identité (« Prénom N. », commune, indicateur « mineur »), parcours, offres, analyses du besoin, KPI. **Exclus** : email, téléphone, adresse complète, date et lieu de naissance, situation France Travail / Mission Locale, textes libres, liens Drive/CV/PDF/photo, résultats et scores de tests, données de santé/handicap, contact d'urgence, questions de tests et compteur de sorties d’onglet des questionnaires internes, n° de sécurité sociale (clé absente). **Fiches candidats : liste blanche** (DTO champ par champ `candidateExposure.ts`). **Péda** : alternant réduit à « Prénom N. » + session, entreprise (nom) et dates de contrat ; jamais email, téléphone, adresse, tuteur, détail libre de rupture ; motif de rupture regroupé (4 catégories) ; agrégats : effectifs de 1 à 4 masqués + masquage complémentaire étiqueté `masqué` (aucune cellule masquée déductible par soustraction ; `<5` réservé aux valeurs de 1 à 4) |
| Destinataires | Éditeur du client LLM (Anthropic) — sous-traitant, DPA à signer (M1, ouvert) |
| Transferts hors UE | À qualifier (CCT / DPF) — M1 |
| Durées | Journal d'accès `mcp_audit_log` : 365 j ; refresh tokens OAuth : 30 j (purge expirés +7 j) ; clients OAuth inactifs : 90 j ; logs techniques : 30 j |
| Mesures de sécurité | OAuth 2.1 + PKCE, code à usage unique, rotation des refresh tokens, RBAC, quotas par utilisateur (1000 appels / 2000 fiches par 24 h), alerte à 80 %, pagination ≤ 50, outils en lecture seule, journal nominatif sans PII |
| AIPD | À réaliser (M1) |

## Périmètre péda (alternants)

- Outils : `list_sessions`, `get_session`, `session_stats`, `list_sequences_overdue`, `list_sequences_upcoming`, `list_alternant_sequences`, `list_alternants`, `get_alternant`, `list_ruptures`, `rupture_stats`, `peda_kpi_overview`, `peda_draft_stats`, `get_alternant_filiz`, `list_filiz_alternants`, `filiz_folder_stats`. Accès : rôle PEDA ou RESPONSABLE+.
- Consentement : un alternant n'est exposé que si `candidate_id` est lié à un candidat ayant `ai_processing=true` (règle stricte de `candidateExposure.ts`). Les alternants créés sans candidat lié sont **invisibles** du MCP.
- Recherche nominative : le nom/prénom (3 caractères min.) n'est qu'un filtre en entrée ; la sortie ne contient que « Prénom N. ».
- Point ouvert : le libellé du consentement `ai_processing` (« résumé de profil via IA locale ») ne couvre pas explicitement le suivi pédagogique ni un LLM tiers — à faire valider par le DPO et à reformuler à la prochaine version du corpus légal.
- `list_notifications` : titre/message/lien des notifications `peda` et `candidate` masqués (noms en texte libre, non filtrables par consentement).
- Agrégats (`session_stats`, `rupture_stats`, `peda_kpi_overview`) : alternants sans consentement `ai_processing` exclus des décomptes. `list_ruptures` reste nominatif (« Prénom N. »), non masqué par k, réservé PEDA / RESPONSABLE+.
- Suivi Filiz (`get_alternant_filiz`, `list_filiz_alternants`, `filiz_folder_stats`) : lecture du miroir local `Alternant.filiz` uniquement (aucun appel Filiz). Exposé : « Prénom N. », session, étape, étape de départ, dossier en cours, dates de mise à jour. Jamais `folder_id`, `student_id`, `company_siret`, contact. Consentement `ai_processing` requis ; effectifs 1-4 masqués dans `filiz_folder_stats`.
