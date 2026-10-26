# Questionnaires repris de ClassMarker

- `raw/` : exports PDF « imprimer le test » de ClassMarker (énoncés et choix, **sans les bonnes réponses**).
- `jsons/` : les mêmes tests au format d'import de l'application (format : [`../README.md`](../README.md) §8bis).

## Importer un questionnaire

1. `/rh/questionnaires` → **Importer JSON** → choisir un fichier de `jsons/` → vérifier l'aperçu → **Importer en brouillon**.
2. Ouvrir le questionnaire → **Tester** pour le passer soi-même (rien n'est écrit sur une fiche ; le PDF reste téléchargeable depuis Résultats avec « Inclure les passages de test »).
3. Passer le questionnaire en **actif** : il apparaît dans la modale « liens de test » de la fiche candidat.

Un questionnaire n'est plus modifiable après le premier vrai passage : le dupliquer en v2 pour le corriger.

## Fichiers

| Fichier | PDF source | Questions | Points | TP | Réponses libres |
|---|---|---|---|---|---|
| `assistante-direction.json` | `ClassMarker - Professional online testing.pdf` | 20 | 10 (0,5 / question) | AD | Q5 « reçues » |
| `negociateur-technico-commercial.json` | `ClassMarker -  Négociateur Technico-commercial.pdf` | 20 | 10 (0,5 / question) | NTC | Q1 « envoyé » |
| `conseiller-commercial.json` | `ClassMarker - Conseiller commercial.pdf` | 20 | 10 (0,5 / question) | CC | Q1 « envoyé » |
| `charge-accueil-gestion-administrative.json` | `ClassMarker - Chargé d'accueil et de gestion administrative.pdf` | 20 | 10 (0,5 / question) | — (à renseigner) | — |
| `responsable-etablissement-marchand.json` | `ClassMarker - Responsable d'établissement marchand.pdf` | 19 | 30 (1 ou 2 / question, repris du PDF) | REM | — |

Réglages communs : 20 min, seuil 50 %, pas de feedback immédiat, pas de question passable, ordre des réponses fixe. Tous modifiables dans l'éditeur.

## Écarts avec les PDF

- **Bonnes réponses déduites** : les PDF ne les contiennent pas. Cas les moins évidents, à faire valider :
  - NTC Q2 (intrus Hypothèse / Affirmation / Opinion) → « Affirmation ».
  - NTC Q8 (formule de politesse) → « Veuillez agréer… ».
  - REM Q9 (planning d'équipe) → Excel ; REM Q12 (suivi des ventes en temps réel) → le tableau de bord ; REM Q17 (conflit) → style directif (validé).
  - Conseiller commercial Q4 (intrus) → « Ordinateur ».
  - Assistante de Direction Q14 → `=MOYENNE(B1:B10)` (énoncé précisé « version française »).
- **Fautes et incohérences corrigées** : « Othographe », « ces deux propositions » (il y en a trois), « Je lui dit », « Mot / Exceller » → Word / Excel, « L'inventeur » → « L'inventer », tutoiement / vouvoiement harmonisés (vouvoiement).
- **Énoncés ajustés** : Assistante de Direction Q7 « à fabriquer » → « à facturer » ; Q8, la suite demandait deux nombres pour un seul choix → un seul nombre demandé.
- **Chargé d'accueil** : la bonne réponse est très souvent A — activer « Mélanger l'ordre des réponses » est conseillé.
