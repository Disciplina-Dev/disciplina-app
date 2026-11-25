# Suivi des accords de sous-traitance (DPA) — Art. 28

> Brouillon à valider par le DPO (Séverine DUGAIN). Source : `INFRA_RGPD_AUDIT.md` (GDPR_INF_05.2).
> Registre général : [`../registre-traitements.md`](../registre-traitements.md) (section 5).

Critère : chaque sous-traitant a un DPA archivé **ou** une action ouverte tracée ci-dessous.

## Procédure d'archivage

- Ne pas committer de PDF volumineux ni de documents signés contenant des données personnelles : les déposer sur le Drive organisationnel.
- Renseigner ici le lien Drive, la date de signature et la version du DPA.
- Un DPA en ligne (acceptation dans une console) : archiver une capture ou un PDF horodaté de l'acceptation.
- Vérifier aussi les contrats déjà signés mais non archivés (Drive, e-mails, comptes fournisseurs) avant de relancer un fournisseur.

## Suivi

Statuts : `Archivé` · `À signer` · `À confirmer` · `Sans objet`.

| Sous-traitant | Traitements | Données | Pays / transfert | DPA | Action ouverte |
|---|---|---|---|---|---|
| Google (Drive, Gmail, Calendar) | T1, T3, T5, T7, T9 | Fiches candidats, CV, e-mails, agendas | UE, accès hors UE possible | À signer | Accepter l'avenant de traitement de données Google (console admin Workspace), archiver la preuve ; vérifier si déjà accepté |
| Sentry | T8 | Erreurs, traces, replays éventuels | UE (Allemagne) selon la politique | À signer | Signer le DPA ; confirmer région et rétention du DSN de production ; confirmer le masquage des replays |
| DocuSeal | T6 | Identité des signataires, contrats | Défaut du code : `docuseal.com` (hors UE) | À signer | Signer le DPA ; basculer `DOCUSEAL_BASE_URL` / `DOCUSEAL_SIGN_URL` sur `docuseal.eu` ou auto-héberger ; vérifier le `.env` de production |
| Filiz | T2 | Suivi des dossiers alternants | À confirmer | À confirmer | Confirmer localisation et existence d'un DPA ; sinon le demander |
| Anthropic (via MCP) | T4 | Données minimisées de `registre-mcp.md` | Hors UE, non qualifié | À signer | Signer le DPA, qualifier le transfert (CCT / DPF, TIA) — voir 05.4 ; sinon désactiver le MCP |
| ClassMarker | T5 (transition) | Résultats, identifiant candidat | Hors UE | À confirmer | Remplacé par les questionnaires internes : confirmer la résiliation et la suppression des données historiques ; sinon archiver le DPA |
| Yousign | — | — | — | Sans objet | Non utilisé en production (confirmé équipe) : supprimer ou documenter `back/src/external/yousign/` |
| Hébergement (Mac mini auto-hébergé) | Tous | Toutes | France, hébergement interne | Sans objet | Aucun tiers d'hébergement ; à revalider si migration (`INFRA_MIGRATION_STUDY.md`) |
| Sauvegardes | Tous | Dumps des bases | À qualifier | À confirmer | Identifier où et chez qui sont stockées les sauvegardes ; DPA si tiers. Rétention actuelle : 7 jours, chiffrées (age), sur le serveur ; effacement des personnes : voir `registre-traitements.md` (GDPR_INF_06.4). Si copie hors site ajoutée : même rétention requise |
| Ollama | T1 | Résumé IA | Local, aucun transfert | Sans objet | — |

Brevo n'est pas utilisé (confirmé) : aucun DPA à obtenir.

## Points à vérifier par le DPO / la direction

1. Contrats ou DPA déjà signés mais non archivés (Drive, e-mails, comptes fournisseurs).
2. Responsable de chaque action ci-dessus et échéance.
