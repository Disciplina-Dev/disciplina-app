# Champs à compléter avant publication

Ce fichier n'est **pas** rendu par l'application. Il recense tous les placeholders
`[[NOM_DU_CHAMP]]` présents dans les documents légaux de ce dossier.

Tant qu'un placeholder subsiste, le corpus légal ne doit pas être considéré comme
publiable : il s'agit d'un modèle de travail, pas d'un avis juridique. Une relecture
par un conseil juridique est requise avant mise en ligne.

Pour lister les placeholders restants :

```bash
grep -rno '\[\[[A-Z_]*\]\]' front/disciplina-front/src/content/legal/
```

## Identité de l'éditeur

| Placeholder | Description | Exemple |
|---|---|---|
| `[[NOM_ORGANISME]]` | Dénomination sociale du centre de formation | Disciplina Formation |
| `[[FORME_JURIDIQUE]]` | Forme juridique | SAS |
| `[[CAPITAL]]` | Capital social | 10 000 € |
| `[[SIRET]]` | Numéro SIRET (14 chiffres) | 123 456 789 00012 |
| `[[RCS]]` | Ville et numéro d'immatriculation au RCS | Saint-Denis (La Réunion) 123 456 789 |
| `[[TVA_INTRA]]` | Numéro de TVA intracommunautaire | FR12345678900 |
| `[[ADRESSE_SIEGE]]` | Adresse postale complète du siège | 1 rue de l'Exemple, 97400 Saint-Denis |
| `[[TELEPHONE]]` | Téléphone de contact | +262 262 00 00 00 |
| `[[EMAIL_CONTACT]]` | Email de contact général | contact@exemple.re |
| `[[DIRECTEUR_PUBLICATION]]` | Nom du directeur de la publication | Prénom Nom |

## Activité de formation

| Placeholder | Description | Exemple |
|---|---|---|
| `[[NDA_FORMATION]]` | Numéro de déclaration d'activité de prestataire de formation | 04 97 00000 97 |
| `[[CERTIF_QUALIOPI]]` | Référence de la certification Qualiopi, ou « non applicable » | Certificat n° XXXXX délivré le JJ/MM/AAAA |

## Protection des données

| Placeholder | Description | Exemple |
|---|---|---|
| `[[EMAIL_DPO]]` | Email du DPO ou du référent RGPD | dpo@exemple.re |

> Si aucun DPO n'est désigné, remplacer par un référent RGPD nommé et indiquer
> explicitement dans la politique de confidentialité qu'aucune désignation de DPO
> n'est obligatoire au sens de l'article 37 du RGPD.

## Hébergement et service

| Placeholder | Description | Exemple |
|---|---|---|
| `[[HEBERGEUR]]` | Raison sociale de l'hébergeur de l'application | Hébergement interne — [[NOM_ORGANISME]] |
| `[[HEBERGEUR_ADRESSE]]` | Adresse de l'hébergeur | 1 rue de l'Exemple, 97400 Saint-Denis |
| `[[URL_APP]]` | URL de production de l'application | https://app-reunion.disciplina.re |

> L'application est déployée sur un Mac mini via Docker, bases de données locales.
> L'« hébergeur » au sens de la LCEN est donc probablement l'organisme lui-même :
> à confirmer avec le conseil juridique.

## Versioning documentaire

| Placeholder | Description | Exemple |
|---|---|---|
| `[[VERSION_DOC]]` | Version du corpus légal | 2026-08-v1 |
| `[[DATE_MAJ]]` | Date de dernière mise à jour | 4 août 2026 |

> `[[VERSION_DOC]]` doit être cohérent avec la valeur `consent_version` stockée
> avec les consentements candidats (cf. Faille 1 de `RGPD.md`, non encore
> implémentée). Toute modification de fond du corpus impose d'incrémenter cette
> version et d'en informer les Utilisateurs.
