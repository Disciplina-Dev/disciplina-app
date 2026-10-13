# Fiche de registre — Assistance LLM via MCP (Art. 30)

> Brouillon à valider par le DPO / responsable de traitement. Voir [`MCP_RGPD_AUDIT.md`](../MCP_RGPD_AUDIT.md).

| Champ | Contenu |
|---|---|
| Traitement | Consultation du CRM Disciplina par un assistant LLM (serveur MCP, `POST /api/mcp`) |
| Responsable | Centre de formation (Disciplina) |
| Finalité | Aider les salariés à rechercher et synthétiser les fiches candidats / entreprises / offres / KPI |
| Base légale | Intérêt légitime (Art. 6.1.f) ; candidats : consentement `ai_processing` requis |
| Personnes concernées | Candidats, contacts entreprise, salariés utilisateurs |
| Catégories de données | Identité, coordonnées, parcours, offres, analyses du besoin, KPI. **Exclus** : données de santé/handicap, contact d'urgence, questions de tests, n° de sécurité sociale (masqué) |
| Destinataires | Éditeur du client LLM (Anthropic) — sous-traitant, DPA à signer (M1, ouvert) |
| Transferts hors UE | À qualifier (CCT / DPF) — M1 |
| Durées | Journal d'accès `mcp_audit_log` : 365 j ; refresh tokens OAuth : 30 j (purge expirés +7 j) ; clients OAuth inactifs : 90 j ; logs techniques : 30 j |
| Mesures de sécurité | OAuth 2.1 + PKCE, code à usage unique, rotation des refresh tokens, RBAC, quotas par utilisateur (1000 appels / 2000 fiches par 24 h), alerte à 80 %, pagination ≤ 50, outils en lecture seule, journal nominatif sans PII |
| AIPD | À réaliser (M1) |
