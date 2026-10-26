# Remplacement de ClassMarker — Étude et recommandation

> **Objet :** choisir une solution pour remplacer ClassMarker dans l'application Disciplina (évaluation des candidats et apprenants par quiz).

---

## 1. Situation actuelle

Aujourd'hui, le service Recrutement/RH envoie un lien ClassMarker au candidat. Il passe un quiz, puis ClassMarker renvoie la note à notre backend.

Ce qui existe déjà dans le code :

| Endpoint | Rôle |
|---|---|
| `GET /api/classmarker/links` | Récupère les liens de test (RH / ADMIN) |
| `POST /api/webhooks/classmarker` | Reçoit le résultat envoyé par ClassMarker |
| `GET /api/webhooks/classmarker/stream` | Flux SSE pour afficher les résultats en direct |
| `GET /api/webhooks/classmarker/result/:candidateId` | Lit le résultat stocké |

**Point important :** toute la « plomberie » (stockage du résultat dans MongoDB, affichage en direct, lien avec la fiche candidat) est déjà chez nous. ClassMarker ne fait que **afficher le quiz et calculer la note**. C'est la partie la plus simple à reprendre.

## 2. Pourquoi quitter ClassMarker

| Problème | Explication | Risque |
|---|---|---|
| **Transfert de données hors UE** | ClassMarker est une société non européenne, avec un hébergement hors UE. Les noms, emails et résultats de nos candidats sortent de l'Union européenne. | Non-conformité aux articles 44 à 49 du RGPD si les garanties (clauses contractuelles types, analyse d'impact du transfert) ne sont pas documentées. |
| **Sous-traitant difficile à maîtriser** | Il faut un contrat de sous-traitance (article 28 RGPD) clair : durée de conservation, sécurité, suppression. | En cas de contrôle CNIL, c'est Disciplina qui est responsable du traitement. |
| **Données dupliquées** | Les résultats existent à la fois chez ClassMarker et chez nous. | Droit à l'effacement plus compliqué à garantir. |
| **Coût récurrent** | Abonnement payant, qui augmente avec le nombre de tests. Avec l'ouverture de l'Ouest et du Sud, le volume va monter. | Coût qui croît avec l'activité. |
| **Dépendance** | Webhook externe, comptes externes, format imposé. | Si l'outil change ses prix ou son API, nous subissons. |

## 3. Les options possibles

### Option A — Développer un module de quiz dans l'app Disciplina ✅ (recommandée)

Créer un module « Évaluations » dans le backend existant (Express + GraphQL + MongoDB) et dans le frontend React.

**Avantages**
- **RGPD maîtrisé de bout en bout** : les données ne quittent jamais nos serveurs. Pas de sous-traitant supplémentaire, pas de transfert hors UE.
- **Coût quasi nul** : pas d'abonnement. Seul coût : le temps de développement (déjà dans nos compétences).
- **Intégration native** : le résultat est directement lié à la fiche candidat, sans webhook externe.
- **Réutilisation de l'existant** : `HmacService` (déjà utilisé pour les liens de relance) pour signer les liens de test, le flux SSE, l'authentification JWT, les rôles RH/ADMIN.
- **Adapté à nos métiers** : on peut créer des tests par Titre Professionnel (Assistant de Direction, Conseiller Commercial, NTC, REM).

**Inconvénients**
- Temps de développement initial (estimé 3 à 5 semaines pour une première version).
- Maintenance à notre charge.
- Les fonctions avancées (surveillance par webcam, banque de questions géante) ne seront pas là au début — mais nous n'en avons pas besoin pour du positionnement.

### Option B — Logiciel open source auto-hébergé (Moodle, TCExam, LimeSurvey)

| Outil | Pour | Contre |
|---|---|---|
| **Moodle** (module Quiz) | Très complet, standard du secteur de la formation, gratuit | Très lourd à installer et maintenir, interface datée, intégration avec notre app complexe (plugins, API web services) |
| **TCExam** | Spécialisé examens, léger | Projet peu actif, interface ancienne, intégration manuelle |
| **LimeSurvey** | Bon pour les questionnaires, a une API | Fait pour des enquêtes, pas pour noter des tests ; notation limitée |

**Avantages** : gratuit, hébergeable en France, RGPD maîtrisable.
**Inconvénients** : un **deuxième logiciel à héberger, sécuriser, mettre à jour** (failles de sécurité régulières sur Moodle par exemple). Les candidats ont un deuxième compte, et il faut quand même coder la synchronisation avec notre app. On paie en maintenance ce qu'on économise en licence.

### Option C — Un autre SaaS européen (hébergé dans l'UE)

Des outils existent avec hébergement européen (ex. Wooclap, ou des modules d'évaluation de LMS français).

**Avantages** : rapide à mettre en place, hébergement UE.
**Inconvénients** : abonnement récurrent, toujours un sous-traitant à encadrer (contrat article 28), intégration par API/webhook comme aujourd'hui. On change de fournisseur mais on garde les mêmes faiblesses (dépendance, coût, données en double).

### Option D — Google Forms (déjà chez Google Workspace)

À éviter pour ce besoin : notation limitée, peu sécurisé contre la triche, et les données passent par Google (transferts à encadrer). Pas d'intégration propre avec la fiche candidat.

## 4. Tableau comparatif

| Critère | A. Module interne | B. Open source | C. SaaS UE | ClassMarker (actuel) |
|---|---|---|---|---|
| RGPD | ⭐⭐⭐ total | ⭐⭐⭐ si bien hébergé | ⭐⭐ contrat nécessaire | ⭐ transfert hors UE |
| Sécurité | ⭐⭐⭐ un seul système à sécuriser | ⭐⭐ un 2e système à patcher | ⭐⭐ dépend du fournisseur | ⭐⭐ |
| Coût annuel | ~0 € (hors temps dev) | Hébergement + maintenance | Abonnement | Abonnement |
| Intégration app | ⭐⭐⭐ native | ⭐ difficile | ⭐⭐ API/webhook | ⭐⭐ webhook |
| Mise en place | 3–5 semaines | 2–4 semaines + intégration | Quelques jours | — |
| Adapté aux TP Disciplina | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |

## 5. Recommandation

**Je recommande l'option A : développer le module d'évaluation directement dans l'app Disciplina.**

Pourquoi :
1. **Le plus dur est déjà fait.** Stockage, liens signés, affichage en direct, rôles : tout existe. Il reste à construire l'éditeur de questions et la page de passage du test.
2. **C'est la seule option où le RGPD est réglé « par conception »** (article 25 : protection des données dès la conception). Plus de sous-traitant, plus de transfert.
3. **C'est la moins chère dans la durée**, surtout avec la croissance (Nord + Ouest + Sud).
4. **C'est un atout Qualiopi** : les preuves (tests, résultats, dates) sont centralisées dans un seul outil, faciles à présenter à l'auditeur.

## 6. Architecture proposée

Elle respecte les conventions de `HOWTOCONTRIBUTE.md` et `CONVENTION.md`.

```
back/src/
  types/assessment.types.ts               Types : Assessment, Question, Attempt
  db/mongo/schemas/assessment.schema.ts   Schémas Mongoose
  repositories/mongo/
    AssessmentRepository.ts               CRUD des tests et questions
    AttemptRepository.ts                  Tentatives et résultats
  services/
    AssessmentService.ts                  Création, correction, calcul de la note
  external/crypto/                        Réutilise HmacService pour signer les liens
  graphql/assessment/                     typeDefs.ts + resolver.ts (gestion par RH/ADMIN)
  rest/assessment/                        route.ts + controller.ts (passage du test public)
```

### Collections MongoDB

- **`assessments`** : titre, Titre Professionnel visé (ex. `NTC`, `CONSEILLER_COMMERCIAL`), durée, note minimale, questions (QCM, vrai/faux, réponse courte), version.
- **`attempts`** : `candidateId`, `assessmentId`, date de début, date de fin, réponses, note, statut, `expiresAt`.

### Parcours

1. Le RH choisit un test depuis la fiche candidat → l'app génère un **lien unique signé HMAC** avec date d'expiration (même principe que les relances).
2. Le candidat ouvre le lien → pas de compte à créer → il lit la mention d'information RGPD → il passe le test (minuteur côté serveur).
3. À la fin, le serveur corrige, enregistre la note et l'envoie dans le **flux SSE existant** → le RH voit le résultat en direct.
4. Les endpoints `classmarker` sont supprimés à la fin de la migration.

## 7. Mesures RGPD et sécurité

**RGPD**
- **Minimisation** : on ne stocke que le nécessaire (identifiant candidat, réponses, note, dates).
- **Information** : mention avant le test (finalité, durée de conservation, droits, contact).
- **Durée de conservation** : par exemple 2 ans après le dernier contact pour un candidat non retenu ; durée du dossier de formation pour un apprenant (à valider avec Séverine DUGAIN, assistante qualité). Suppression automatique par index TTL MongoDB.
- **Droits des personnes** : suppression des tentatives incluse dans la suppression du candidat.
- **Registre des traitements** : ajouter le traitement « Évaluation de positionnement ».
- **Hébergement** : serveur en France (ex. OVHcloud, Scaleway).

**Sécurité**
- Liens signés HMAC, à usage unique, avec expiration.
- **Correction côté serveur uniquement** : les bonnes réponses ne sont jamais envoyées au navigateur.
- Minuteur contrôlé par le serveur (impossible de tricher en modifiant le navigateur).
- Ordre aléatoire des questions et des réponses.
- Limitation de débit (`express-rate-limit`, déjà installé) sur les routes publiques.
- Gestion des tests limitée aux rôles RH et ADMIN via `authGuard`.
- Journalisation avec `logger` (pino), sans données personnelles dans les logs.

---

**En résumé :** construire le module dans l'app coûte quelques semaines de développement, mais supprime l'abonnement, règle le problème RGPD à la racine, renforce la sécurité et centralise les preuves Qualiopi.

