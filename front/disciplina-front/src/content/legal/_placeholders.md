# Placeholders des documents légaux

Ce fichier n'est **pas** rendu par l'application.

Les documents de ce dossier contiennent des placeholders `[[CLE]]` substitués au rendu
par `LegalDocument` à partir de `src/lib/legalProfile.ts` (**source unique des valeurs**,
un profil par tenant). Aucune valeur d'identité ne doit être écrite en dur dans un `.md`.

- Région retenue : `?region=reunion|annemasse` dans l'URL, sinon le dernier tenant
  connecté (`regionStore`), sinon `reunion`.
- Une clé absente du profil reste visible (`[[CLE]]`) et déclenche un `console.warn`.
- Ajouter une clé : la déclarer dans `LegalProfile` **et** dans chaque profil.

Clés disponibles : `NOM_ORGANISME` `FORME_JURIDIQUE` `CAPITAL` `SIRET` `RCS` `TVA_INTRA`
`ADRESSE_SIEGE` `TELEPHONE` `EMAIL_CONTACT` `EMAIL_DPO` `DIRECTEUR_PUBLICATION`
`NDA_FORMATION` `N_QUALIOPI` `HEBERGEUR` `HEBERGEUR_ADRESSE` `MEDIATEUR_NOM` `URL_APP`
`VERSION_DOC` `DATE_MAJ`.

`VERSION_DOC` doit rester cohérent avec `consent_version` (cf. `RGPD.md`, Faille 1).
Toute modification de fond impose d'incrémenter cette version.

Lister les placeholders utilisés :

```bash
grep -rno '\[\[[A-Z_]*\]\]' front/disciplina-front/src/content/legal/
```
