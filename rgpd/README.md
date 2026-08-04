# Dossier RGPD

Point d'entrée des éléments de conformité RGPD du projet.

## Audit

L'audit de conformité et la liste des failles identifiées se trouvent dans
[`RGPD.md`](../RGPD.md) à la racine du dépôt.

## Corpus légal

Les documents légaux publiés par l'application sont versionnés dans le projet
front, afin que les imports Vite `?raw` fonctionnent sans configuration
supplémentaire :

```
front/disciplina-front/src/content/legal/
├── _placeholders.md              # champs à compléter avant publication
├── cgu/
│   ├── socle.md                  # tronc commun
│   ├── annexe-candidat.md
│   ├── annexe-entreprise.md
│   └── annexe-interne.md
├── mentions-legales.md
├── politique-confidentialite.md
└── politique-cookies.md
```

Ces documents sont rendus aux adresses `/legal/cgu`, `/legal/cgu/:audience`,
`/legal/mentions`, `/legal/confidentialite` et `/legal/cookies`.

> **Ces documents sont un modèle de travail, pas un avis juridique.** Ils doivent
> être relus par un conseil juridique et leurs placeholders `[[...]]` renseignés
> avant toute publication.

Pour lister les placeholders restants :

```bash
grep -rho '\[\[[A-Z_]*\]\]' front/disciplina-front/src/content/legal/ | sort | uniq -c
```

## Accords de sous-traitance (DPA)

Les DPA signés avec les sous-traitants (Google, Sentry, DocuSeal, ClassMarker,
Brevo) sont à archiver dans `rgpd/dpas/` — voir les failles 7 et 12 de l'audit.

Ne pas committer de documents volumineux : les déposer sur le Drive
organisationnel et référencer le lien dans le registre des traitements.

## Registre des traitements

Non encore constitué — voir la faille 3 de l'audit.
