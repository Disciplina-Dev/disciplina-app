# Connecteur MCP Filiz × Claude

## Analyse des risques RGPD par catégorie de données personnelles

| | |
|---|---|
| **Projet** | Disciplina — intégration de l'API partenaires Filiz dans un serveur MCP |
| **Date** | 22 octobre 2026 |
| **Statut** | Document de travail, à valider par le DPO ou un conseil juridique |

---

## Sommaire

1. [Contexte et méthode](#1-contexte-et-méthode)
2. [Analyse par catégorie de données](#2-analyse-par-catégorie-de-données)
3. [Failles transversales](#3-failles-transversales)
4. [Matrice d'exposition recommandée](#4-matrice-dexposition-recommandée)
5. [Principes de mise en œuvre technique](#5-principes-de-mise-en-œuvre-technique)
6. [Actions de conformité](#6-actions-de-conformité)
7. [Références](#7-références)

---

## 1. Contexte et méthode

### 1.1 Objet

Ce document recense chaque catégorie de données personnelles susceptible d'être accessible via un serveur MCP encapsulant l'API Filiz. Pour chacune, il indique le risque RGPD associé, son niveau de criticité et la mesure recommandée.

Filiz ne proposant pas de serveur MCP, Disciplina développe son propre serveur. Celui-ci appelle l'API partenaires et expose des outils à Claude (Claude Team).

### 1.2 Hypothèse de travail

Les endpoints exacts de l'API Filiz n'ont pas encore été analysés. Le recensement s'appuie sur le contenu d'un dossier d'alternance tel que Filiz le gère :

- CERFA FA13 (n° 10103) ;
- convention de formation ;
- facturation OPCO ;
- ruptures ;
- émargement.

La liste des champs réellement exposés devra être confirmée à partir de la collection Postman de l'API.

### 1.3 Principe clé

Tout champ renvoyé par un outil MCP entre dans le contexte de Claude. Il est alors :

- transféré à Anthropic, sous-traitant situé hors UE (transfert encadré par le DPA et les clauses contractuelles types) ;
- conservé dans l'historique de la conversation ;
- potentiellement visible par toute personne ayant accès à cette conversation.

> **Règle de conception :** seules les données strictement nécessaires à la finalité (consultation administrative du suivi des contrats) doivent quitter le serveur MCP.

### 1.4 Échelle de criticité

| Niveau | Signification | Traitement |
|---|---|---|
| 🔴 **Critique** | Donnée dont la transmission constituerait une non-conformité caractérisée | Exclusion absolue |
| 🟠 **Élevé** | Donnée sensible ou sans utilité, préjudiciable en cas de divulgation | Exclure, pseudonymiser ou restreindre |
| 🟡 **Modéré** | Donnée utile mais identifiante | Exposer sous condition |
| 🟢 **Faible** | Donnée nécessaire à la finalité ou non personnelle | Exposer |

---

## 2. Analyse par catégorie de données

### 2.1 Identité de l'apprenant

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **Nom, nom d'usage, prénom** | Identification directe. Combinés à d'autres champs, ils permettent de reconstituer une fiche complète dans la conversation. | 🟡 Modéré | Exposer uniquement si le cas d'usage l'exige (« où en est le contrat de X ? »). Sinon, travailler sur l'identifiant de contrat. |
| **NIR (n° de sécurité sociale)** | Usage strictement encadré en France (décret-cadre NIR). Sa transmission à un modèle d'IA n'entre dans aucune finalité autorisée. | 🔴 Critique | Exclusion absolue, filtrée côté serveur. |
| **Date de naissance** | Identifiant fort. Révèle la minorité de l'apprenant. | 🟠 Élevé | Remplacer par un indicateur « mineur oui/non » ou une tranche d'âge si nécessaire. |
| **Sexe** | Faible en soi, mais source d'analyses discriminantes si croisé (statistiques genrées, tri). | 🟢 Faible | Exclure par défaut : aucun usage administratif courant ne le requiert. |
| **Lieu de naissance, nationalité** | Pas une donnée sensible au sens de l'art. 9, mais critère de discrimination prohibé (Code du travail, L1132-1). Peut révéler indirectement l'origine. | 🟠 Élevé | Exclure. |

### 2.2 Coordonnées et entourage

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **Adresse postale** | Localisation d'une personne, souvent mineure. | 🟠 Élevé | Exclure. Conserver la commune seulement si un usage logistique le justifie. |
| **Email, téléphone** | Contact direct. Risque de réutilisation hors finalité (relance automatisée). | 🟡 Modéré | Exposer uniquement dans un outil de relance dédié, jamais dans les listes. |
| **Représentant légal** (nom, adresse, contact) | Données d'un tiers non partie au contrat de travail, dans un contexte de minorité. | 🟠 Élevé | Exclure par défaut. |

### 2.3 Situation et parcours

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **RQTH** (travailleur handicapé) | Donnée de santé (art. 9 RGPD) : traitement interdit sauf exception. Révélation particulièrement préjudiciable. | 🔴 Critique | Exclusion absolue. |
| **Sportif de haut niveau** | Faible sensibilité, sans utilité administrative pour l'agent. | 🟢 Faible | Exclure. |
| **Situation avant contrat** (demandeur d'emploi, RSA…) | Révèle une situation socio-économique ; risque de stigmatisation. | 🟠 Élevé | Exclure. |
| **Diplômes, dernière classe suivie** | Utile au suivi, mais peut alimenter un tri de candidats (question du haut risque AI Act). | 🟡 Modéré | Exposer le diplôme préparé (formation suivie), pas l'historique scolaire. |
| **Projet de création d'entreprise** | Sans utilité pour l'usage visé. | 🟢 Faible | Exclure. |

### 2.4 Contrat et rémunération

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **Salaire, grille de rémunération** | Donnée financière personnelle. Confidentialité vis-à-vis des collègues ayant accès au connecteur. | 🟠 Élevé | Exclure, ou restreindre à un outil réservé au rôle RH ou facturation. |
| **Avantages en nature** (logement, nourriture) | Révèle les conditions de vie. | 🟡 Modéré | Exclure. |
| **Dates, type, statut du contrat, formation, OPCO** | Cœur de l'usage administratif : c'est la finalité légitime. | 🟢 Faible | Exposer. |
| **Motif de rupture** | Peut révéler un conflit, une faute, voire une situation de santé ou personnelle. | 🟠 Élevé | Exposer seulement le fait et la date de rupture, pas le motif libre. |

### 2.5 Maître d'apprentissage et employeur

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **Nom, prénom, email du tuteur** | Donnée personnelle d'un salarié tiers. | 🟡 Modéré | Exposer nom et contact professionnel si utile au suivi. |
| **Date de naissance, diplôme, ancienneté du tuteur** | Champs du CERFA sans utilité pour l'agent. | 🟠 Élevé | Exclure. |
| **Employeur** (SIRET, raison sociale) | Personne morale, hors RGPD. Exception : entreprise individuelle, dont le nom est celui d'une personne physique. | 🟢 Faible | Exposer, en traitant le cas des entreprises individuelles comme une donnée personnelle. |

### 2.6 Facturation, assiduité et documents

| Donnée | Risque RGPD | Niveau | Mesure recommandée |
|---|---|---|---|
| **IBAN, RIB** | Donnée financière ; risque de fraude. | 🔴 Critique | Exclusion absolue. |
| **Montants NPEC, factures OPCO** | Données de l'organisme, non personnelles sauf rattachement nominatif. | 🟢 Faible | Exposer en agrégé ou par contrat. |
| **Émargement, absences** | Révèle des comportements ; une absence peut révéler indirectement la santé (arrêt maladie). | 🟠 Élevé | Exposer des compteurs agrégés, jamais les justificatifs ni les motifs. |
| **Signature électronique** (journal d'audit, IP, horodatage) | Métadonnées techniques personnelles sans utilité pour l'agent. | 🟠 Élevé | Exclure ; exposer seulement « signé / non signé ». |
| **Documents PDF** (CERFA signé, convention, pièces d'identité) | Le document contient tous les champs ci-dessus, y compris le NIR et la RQTH : il contourne tout filtrage champ par champ. | 🔴 Critique | Aucun outil ne renvoie de document. Au plus un lien vers Filiz, qui exige une authentification. |

---

## 3. Failles transversales

Ces risques sont indépendants des champs exposés. Ils tiennent à l'architecture ou à l'usage du connecteur.

| Faille | Mécanisme | Mesure |
|---|---|---|
| **Sur-collecte par l'API** | L'API renvoie l'objet complet et le serveur le relaie tel quel. | Liste blanche de champs dans la couche de transformation, jamais de liste noire. |
| **Fuite entre organisations** | Un utilisateur Annemasse obtient des contrats La Réunion si la clé Filiz est partagée ou mal résolue. | Résolution de la clé Filiz par l'organisation issue du jeton d'authentification, jamais d'un paramètre d'outil. |
| **Injection de prompt** | Un champ texte libre contient des instructions poussant Claude à exfiltrer des données (recherche web, autre connecteur). | Ne pas exposer les champs libres ; sinon les délimiter et les tronquer. |
| **Rétention dans les conversations** | Les données restent dans l'historique Claude Team, hors de la gouvernance Filiz et Disciplina. | Fixer une durée de conservation au niveau de l'organisation Claude et l'inscrire au registre. |
| **Partage de conversations et d'artefacts** | Une conversation ou un artefact nominatif est partagé dans un projet ou par lien. | Consigne d'usage : pas de rapports nominatifs en artefact partagé. |
| **Mémoire de Claude** | Des données d'apprentis sont mémorisées d'une conversation à l'autre. | Consigne d'usage ; évaluer la désactivation de la mémoire pour les comptes utilisant le connecteur. |
| **Droits des personnes** | Une demande d'accès ou d'effacement doit couvrir aussi les traces dans Claude. | Journalisation côté serveur MCP (qui a consulté quel contrat), sans stocker le contenu. |
| **Agrégation et profilage** | Le croisement Filiz × Disciplina produit un profil (« alternants à risque de rupture ») : nouveau traitement, potentiellement à haut risque au sens de l'AI Act. | Pas d'outil de scoring ; finalité limitée à la consultation, documentée. |
| **Mineurs** | La présence de mineurs aggrave l'ensemble des risques. | Facteur d'analyse d'impact (AIPD), à trancher avec le DPO. |

---

## 4. Matrice d'exposition recommandée

| ✅ Exposer | 🔄 Dériver ou agréger | ⛔ Exclure |
|---|---|---|
| Nom, prénom de l'apprenant | Indicateur « mineur » (au lieu de la date de naissance) | NIR |
| Statut, type et dates du contrat | Signé / non signé | RQTH |
| Formation, OPCO | Compteurs d'absences | IBAN, RIB |
| Employeur (SIRET, raison sociale) | Date de rupture (sans motif) | Nationalité, lieu de naissance |
| Nom et email pro du tuteur | Montants de facturation par contrat | Adresse, représentant légal |
| | | Salaire, avantages en nature |
| | | Situation avant contrat |
| | | Documents PDF, journaux de signature |
| | | Champs texte libres |

---

## 5. Principes de mise en œuvre technique

- **Liste blanche fermée par défaut :** chaque réponse est reconstruite explicitement, champ par champ. Un champ ajouté plus tard par Filiz (NIR, RQTH…) n'atteint jamais le modèle.
- **Champs dérivés :** transmettre l'information utile (mineur, signé) plutôt que la donnée source (date de naissance, journal de signature), en application du principe de minimisation (art. 5.1.c).
- **Validation de schéma en sortie :** toute évolution inattendue de l'API provoque une erreur plutôt qu'une fuite.
- **Test de non-régression :** vérifier automatiquement qu'aucune sortie d'outil ne contient de clé interdite (`nir`, `rqth`, `iban`, `dateNaissance`, `nationalite`, `salaire`, `motif`).
- **Lecture seule :** aucune opération d'écriture vers Filiz dans un premier temps.
- **Usage exclusif via Claude Team :** seules les offres commerciales bénéficient du DPA Anthropic. Aucun accès depuis des comptes personnels.

---

## 6. Actions de conformité

- [ ] Obtenir l'accord écrit de Filiz (support-api@filiz.io) sur l'usage de l'API via un agent IA.
- [ ] Mettre à jour le registre des traitements : ajouter Anthropic comme sous-traitant, avec la finalité et les durées de conservation.
- [ ] Mettre à jour la politique de confidentialité : mentionner le recours à un sous-traitant IA et le transfert hors UE encadré.
- [ ] Trancher la nécessité d'une AIPD avec le DPO, en raison de la présence de mineurs.
- [ ] Documenter que le connecteur est un outil de consultation administrative, sans décision sur les personnes (AI Act).
- [ ] Confronter la matrice à la collection Postman pour produire la liste blanche définitive par endpoint.

---

## 7. Références

- RGPD, art. 5, 9, 28, 35 et 44 et suivants : <https://www.cnil.fr/fr/reglement-europeen-protection-donnees>
- CNIL, partage de données par API : <https://www.cnil.fr/fr/partage-de-donnees-par-api>
- CNIL, encadrement du NIR : <https://www.cnil.fr/fr/nir-numero-de-securite-sociale>
- Code du travail, art. L1132-1 : <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045391841>
- Anthropic, Data Processing Addendum : <https://www.anthropic.com/legal/data-processing-addendum>
- AI Act, règlement (UE) 2024/1689 : <https://eur-lex.europa.eu/eli/reg/2024/1689/oj>

---

*Avertissement : ce document est une grille d'analyse technique et ne constitue pas un avis juridique.*