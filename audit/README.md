# Questionnaires internes — remplacement de ClassMarker

> Audit fonctionnel, plan et checklist. Complète l'étude `find-classmarker-solution.md` (option A retenue : module interne).
> Branche : `968-feat-remove-classmarker`.

---

## 1. Avis général

**Oui, c'est le bon choix, et c'est faisable sans casser l'existant.** ClassMarker ne fait que deux choses : afficher le quiz et calculer la note. Tout le reste est déjà chez nous :

| Brique | Déjà dans le code | Réutilisable tel quel ? |
|---|---|---|
| Stockage du résultat | `candidate.classmarker` + `candidate.classmarker_history` (Mongo) | ✅ on écrit **au même format** |
| Affichage du score sur la fiche | `CandidateTestScore.tsx`, `useClassMarkerResult.ts` | ✅ |
| Temps réel RH | SSE `GET /api/webhooks/classmarker/stream` + `notifyCandidate()` | ✅ |
| PDF + dépôt Google Drive | `uploadResultPdf()` + `PdfService.generateClassMarkerPdf()` dans `webhook.route.ts` | ✅ à extraire dans un service |
| QR code / lien | `ClassMarkerLinksModal.tsx` (`qrcode.react`) | ✅ seule l'URL change |
| Seuil de réussite | `passed = percentage >= 50` (webhook), `testGateThreshold.ts` (front) | ✅ |
| Multi-région | `runForAllRegions` / `syncWithRegion` | ✅ |

**Ma recommandation clé : pas de « webhook » HTTP vers soi-même.** Le backend reçoit les réponses, corrige, puis appelle **directement** la même fonction que le webhook ClassMarker (`saveTestResult(candidateId, data)` extraite de `webhook.route.ts`). Avantages : pas de secret HMAC à gérer pour un appel interne, pas de requête réseau qui peut échouer, et **le résultat atterrit exactement au même endroit avec le même format** → fiche candidat, PDF, Drive, SSE, MCP fonctionnent sans modification.

Deux points où je propose d'**ajuster votre demande** (à valider, cf. §7) :

1. **Afficher « correct / incorrect » après chaque question** → c'est pratique pour un exercice, mais pour un test de **positionnement/recrutement** ça permet de faire circuler les réponses (un candidat note les bonnes réponses et les partage). Je propose une option par questionnaire : `feedback immédiat : oui / non`. Dans tous les cas le feedback est calculé **par le serveur** après la validation (jamais la bonne réponse dans le navigateur avant).
2. **Saisie du nom + email à chaque fois** → le RH a déjà rempli ces infos dans le CRM, et le lien contient l'identifiant du candidat. Redemander les infos crée un risque d'incohérence (faute de frappe, autre email) et c'est de la donnée en double (RGPD : minimisation). Je propose : **écran d'accueil qui affiche « Vous êtes bien Jean D. ? » + confirmation de l'email** (comparé à celui du CRM), plutôt qu'une saisie libre. Si vous tenez à la saisie libre (ex. QR code affiché au mur pour plusieurs personnes), il faut un mode « lien générique » — voir question Q2.

---

## 2. Ce qu'on NE touche PAS (préservation des données)

- ❌ Aucune modification des champs existants `classmarker` / `classmarker_history` de la collection `candidates` (Mongo). On **continue d'écrire dedans** au même format `ClassMarkerResult`.
- ❌ Aucun renommage de champ (renommer `classmarker` → `assessment` obligerait à migrer toutes les données : non).
- ❌ Aucune table MySQL modifiée.
- ✅ Ajout de **2 nouvelles collections Mongo** uniquement : `questionnaires` et `questionnaire_attempts`.
- ✅ Ajout **optionnel** de champs dans `ClassMarkerResult` (tous facultatifs, donc compatibles avec les anciens documents) :
  - `source?: 'classmarker' | 'internal'` — pour distinguer anciens et nouveaux résultats.
  - `questionnaire_id?: string`, `attempt_id?: string` — lien vers la tentative détaillée.
- ✅ Les routes ClassMarker restent actives pendant la transition (les tests déjà envoyés doivent pouvoir revenir). Suppression seulement en phase finale.
- ✅ `ClassMarkerQuestion.question_id` est un `number` : on garde le format en numérotant les questions 1..N dans le résultat (l'id Mongo réel va dans `attempt`).

---

## 3. Parcours cible

```
RH (CRM, fiche candidat)
  └─ « Envoyer un test » → choisit un questionnaire actif
       └─ back crée une invitation : attempt { status: 'invited', token signé, expiresAt }
            └─ front affiche QR code + lien copiable (même modale qu'aujourd'hui)

Candidat (page publique /test/:token, sans compte)
  1. Accueil : nom du test, durée, nb de questions, mention RGPD
  2. Identification : confirmation nom + email  → bouton « Commencer »
     (le chrono démarre CÔTÉ SERVEUR à ce clic : startedAt)
  3. Question 3/20  [■■■□□□□□□□]   ⏱ 12:34
     → choisit sa réponse → « Valider »
     → (option) affichage Correct ✅ / Incorrect ❌
     → « Question suivante » (pas de retour arrière)
  4. Fin : « Merci, vos réponses ont été envoyées » (score affiché ou non selon option)

Back (à la dernière réponse ou à l'expiration du temps)
  └─ calcule le score → saveTestResult() (= ex-webhook ClassMarker)
       ├─ $set classmarker + $push classmarker_history  (format inchangé)
       ├─ notifyCandidate() → SSE → la fiche RH se met à jour en direct
       └─ PDF → Google Drive du candidat (code existant)

Correcteur (interface interne)
  └─ liste des tentatives, détail réponse par réponse, score, ré-envoi PDF Drive, export
```

---

## 4. Checklist des fonctionnalités

Légende priorité : **P0** = indispensable pour couper ClassMarker · **P1** = rapidement après · **P2** = confort.

### 4.1 Interface « Correcteur » — gestion des questionnaires

- [ ] **P0** Lister les questionnaires (titre, nb questions, durée, statut actif/archivé, nb de passages)
- [ ] **P0** Créer / dupliquer / archiver un questionnaire (pas de suppression dure s'il a déjà des passages)
- [ ] **P0** Paramètres : titre, description/consigne, **durée (minutes)**, seuil de réussite (défaut 50 %), TP visé(s) (`tp_types`), actif oui/non
- [ ] **P0** Option `feedback immédiat` (afficher correct/incorrect après validation) oui/non
- [ ] **P0** Option `allow_skip` (autoriser à passer une question) oui/non
- [ ] **P0** Score final affiché au candidat **en pourcentage uniquement**, sans « réussi / échoué » (décision humaine, art. 22 RGPD)
- [ ] **P0** Éditeur **par blocs** : bouton « + Ajouter une question », chaque bloc = énoncé + type + choix + bonne(s) réponse(s) + points ; modifier, supprimer, dupliquer, **réordonner**
- [ ] **P0** **Import JSON** d'un questionnaire (validation + aperçu avant enregistrement, erreurs ligne par ligne) et **export JSON** (sauvegarde / copie vers une autre région)
- [ ] **P0** Types de question : QCM 1 réponse, QCM plusieurs réponses, vrai/faux
- ~~Type réponse courte~~ — **reporté** (correction manuelle = écran + recalcul en plus ; QCM/VF suffisent pour du positionnement)
- [ ] **P0** Points par question (défaut 1)
- [ ] **P1** Ordre aléatoire **des réponses** seulement au départ (questions dans l'ordre défini)
- ~~Image dans une question~~ — **reporté** (stockage + contrôle sécurité des uploads)
- [ ] **P0** **Mode « Tester le questionnaire »** : le correcteur passe le test réellement, sans rattachement candidat ni écriture du résultat (repère les erreurs de bonne réponse avant un vrai candidat)
- [ ] **P0** **Verrouillage après 1er passage** : un questionnaire déjà passé n'est plus modifiable → bouton « Dupliquer en v2 ». Garantit qu'aucun ancien score n'est faussé (plus simple qu'un snapshot)
- [ ] **P2** Banque de questions partagée entre questionnaires

### 4.2 Interface « Correcteur » — résultats

- [ ] **P0** Liste des passages : candidat, questionnaire, date, durée, score, réussi/échoué, statut (invité / en cours / terminé / expiré)
- [ ] **P0** Filtres : questionnaire, période, statut, réussi/échoué, site/région
- [ ] **P0** Détail d'un passage : chaque question, réponse donnée, bonne réponse, points, temps passé
- [ ] **P0** Lien vers la fiche candidat (et depuis la fiche, l'onglet test existant continue de marcher)
- [ ] **P0** Bouton **« Envoyer / renvoyer le PDF sur Google Drive »** (réutilise `uploadResultPdf`)
- ~~Correction manuelle réponse courte~~ — reporté avec le type « réponse courte »
- ~~**Import CSV de résultats**~~ — hors périmètre (décision Q10)
- [ ] **P1** Export CSV/Excel des résultats filtrés
- [ ] **P1** Annuler/invalider un passage (ex. problème technique) et autoriser un nouveau passage
- [ ] **P2** Statistiques par question (taux de réussite) — **plus tard**, quand le volume de passages le justifie

### 4.3 Côté RH (CRM — existant à adapter)

- [ ] **P0** Dans la fiche candidat, la modale « liens de test » liste nos questionnaires actifs au lieu des liens ClassMarker
- [ ] **P0** Génération du lien unique + **QR code** (PNG téléchargeable, comme aujourd'hui) + bouton copier
- [ ] **P0** Le résultat apparaît en direct sur la fiche (SSE existant)
- [ ] **P0** **Suivi en direct** sur la fiche : invité / en cours « question 7/20 — 8 min restantes » / terminé / expiré (SSE existant)
- [ ] **P0** Durée de validité du lien **15 min par défaut, réglable** par le RH à la génération + bouton « Régénérer » en un clic
- [ ] **P1** Renvoyer / régénérer un lien (invalide l'ancien)
- ~~Envoi du lien par mail~~ — **retiré** (QR scanné sur place, lien de 15 min)

### 4.4 Interface apprenti / candidat (page publique)

- [ ] **P0** Page publique `/test/:token`, **sans compte**, mobile d'abord (ouverture via QR code sur téléphone)
- [ ] **P0** Écran d'accueil : titre, consigne, durée, nombre de questions, **mention d'information RGPD**
- [ ] **P0** Identification : **nom + email pré-remplis depuis le CRM**, le candidat confirme (« C'est bien moi ») avant de commencer ; lien « ce n'est pas moi » → message de contacter le RH
- [ ] **P0** Bouton « Commencer » → démarrage du chrono **serveur**
- [ ] **P0** **Une question par page**
- [ ] **P0** **Progression « Question X / Y » + barre de progression**
- [ ] **P0** **Chrono visible** (temps restant), alerte visuelle à 5 min et 1 min
- [ ] **P0** **Pas de retour arrière** : réponse envoyée au serveur à chaque « Valider », le serveur refuse toute ré-réponse ; le bouton « Précédent » n'existe pas ; le bouton retour du navigateur ramène à la question courante
- [ ] **P0** « Valider » désactivé sans réponse ; bouton « Passer » visible seulement si `allow_skip` actif
- [ ] **P0** Feedback correct/incorrect après validation (si option activée), puis « Question suivante »
- [ ] **P0** **Reprise après coupure** : rechargement de page / perte réseau → reprend à la question courante avec le temps restant réel (le chrono continue côté serveur)
- [ ] **P0** **Chaque réponse enregistrée immédiatement en base** à la validation (règle absolue) : téléphone éteint = rien de perdu
- [ ] **P0** Temps écoulé → envoi automatique, questions restantes = non répondues
- [ ] **P0** Écran de fin : remerciement + score en %
- [ ] **P0** Lien déjà utilisé / expiré → message clair, sans détail technique
- [ ] **P1** Accessibilité : navigation clavier, contraste, tailles tactiles ≥ 44 px, `aria-live` pour le feedback, police lisible
- [ ] **P1** Confirmation avant validation de la dernière question
- [ ] **P0** **Compteur de changements d'onglet / sortie de l'app** (`visibilitychange`), envoyé au serveur et affiché au correcteur — informatif, aucune pénalité auto

### 4.5 Backend

- [ ] **P0** Extraire de `webhook.route.ts` une fonction `saveTestResult(candidateId, data)` (DB + SSE + PDF/Drive) utilisée par le webhook ClassMarker **et** par le nouveau module
- [ ] **P0** Collections `questionnaires` et `questionnaire_attempts` (schémas Mongoose dans `db/mongo/schemas/`, multi-région via `getModels()`)
- [ ] **P0** GraphQL (RH/ADMIN/PEDA, `authGuard`) : CRUD questionnaires, liste/détail des tentatives, création d'invitation
- [ ] **P0** REST public (`rest/questionnaire/`) : `GET /api/q/:token` (état), `POST /start`, `POST /answer`, `POST /finish`
- [ ] **P0** Correction et calcul du score **uniquement côté serveur**
- [ ] **P0** Écriture du résultat au format `ClassMarkerResult` (+ `source: 'internal'`) dans `classmarker` / `classmarker_history`
- [ ] **P0** Job / contrôle lazy d'expiration : tentative commencée et temps dépassé → clôture auto
- [ ] **P0** Tests composants (vitest, vraie Mongo) : parcours complet, pas de retour arrière, expiration, lien rejoué, bonne réponse jamais exposée
- [ ] **P1** MCP : exposer les résultats via `candidateExposure.ts` (déjà filtré) — mettre à jour `rgpd/registre-mcp.md`
- [ ] **P2** Fin de transition : supprimer routes `classmarker`, `CLASSMARKER_*` dans `env.ts`, `api/classmarker.ts`, `utils/classmarker.ts` (garder les données et types)

---

## 5. Sécurité

- [ ] **Lien = jeton aléatoire** (32 octets, `crypto.randomBytes`) stocké **haché** (SHA-256) en base, ou jeton signé `HmacService` avec expiration. Jamais l'`ObjectId` du candidat en clair dans l'URL (aujourd'hui `cm_user_id=<id>` part chez ClassMarker).
- [ ] Expiration du lien **15 min** avant démarrage + **usage unique** (une fois terminé, le lien est mort).
- [ ] **Verrouillage appareil** : au 1er accès le lien est lié à l'appareil (cookie de session `HttpOnly` aléatoire, haché en base). Toute ouverture depuis un autre appareil est refusée → personne ne répond à la place du candidat pendant les 15 min
- [ ] **Les bonnes réponses ne sont jamais envoyées au navigateur** avant validation : l'API `GET` d'une question renvoie uniquement l'énoncé et les choix.
- [ ] Le serveur n'accepte une réponse que pour la **question courante** (index attendu) → pas de retour arrière, pas de saut.
- [ ] **Chrono serveur** : `startedAt` + `durationMinutes` ; toute réponse après `deadline` (+ marge 10 s) est refusée.
- [ ] Rate limit (`express-rate-limit`, déjà présent) sur les routes publiques (ex. 60 req/min/IP) et sur la résolution de jeton (anti-énumération).
- [ ] Validation stricte des entrées (types, longueur des textes, id de choix existant).
- [ ] Échappement du contenu des questions côté front (React par défaut ; **pas** de `dangerouslySetInnerHTML`). Si texte riche voulu → Markdown simple sanitisé.
- [ ] Routes Correcteur protégées par rôles (`requireRoles` / `authGuard`), isolement par région.
- [ ] `logger` sans données personnelles (ids uniquement, pas d'email/nom/réponses).
- [ ] Headers : la page publique ne doit pas exposer le JWT staff ni partager le cookie/localStorage du CRM.

## 6. RGPD

- [ ] **Hébergement 100 % chez nous** → plus de transfert hors UE, plus de sous-traitant ClassMarker (mettre à jour le registre et la politique de confidentialité `content/legal/politique-confidentialite.md`, qui cite ClassMarker).
- [ ] **Mention d'information** sur l'écran d'accueil : responsable, finalité (évaluation de positionnement / recrutement), base légale, durée de conservation, droits, contact.
- [ ] **Minimisation** : nom/email servent à vérifier l'identité, ils ne sont **pas dupliqués** dans la tentative si identiques au CRM (on stocke seulement `identity_confirmed: true`, ou l'email saisi uniquement s'il diffère — cf. Q2).
- [ ] **Durée de conservation** : tentatives supprimées avec le candidat ; purge (TTL) des invitations jamais ouvertes après expiration.
- [ ] **Droit d'accès** : le candidat peut obtenir ses réponses → l'export PDF existant y répond.
- [ ] **Droit à l'effacement** : la suppression d'un candidat supprime aussi ses `questionnaire_attempts`.
- [ ] Pas de décision **entièrement automatisée** (art. 22) : le score aide le RH, la décision reste humaine — à écrire dans la mention.
- [ ] Registre des traitements : ajouter « Évaluation par questionnaire interne » ; retirer ClassMarker des sous-traitants une fois coupé.
- [ ] Supprimer les données chez ClassMarker à la résiliation (demander l'attestation).

## 7. UI / UX

- [ ] Page candidat **mobile first** (QR code → téléphone) : une colonne, gros boutons de choix (carte entière cliquable), bouton principal fixé en bas.
- [ ] En-tête collant : `Question 3 / 20`, barre de progression, chrono.
- [ ] Feedback : couleur **+ icône + texte** (pas seulement vert/rouge, daltonisme).
- [ ] Chrono : passe en orange à 5 min, rouge à 1 min, sans clignoter.
- [ ] Ton rassurant (public apprenti) : « Pas de panique, une seule réponse est attendue ».
- [ ] Charte Disciplina reprise (Tailwind existant), pas de menu CRM sur la page publique.
- [ ] Correcteur : éditeur en 2 colonnes (liste des questions à gauche, édition à droite), sauvegarde explicite, aperçu.
- [ ] États vides, chargement, erreurs gérés partout.

---

## 8. Modèle de données proposé (nouveau, n'impacte rien d'existant)

```ts
// questionnaires
{
  _id, title, description, tp_types: string[],
  duration_minutes: number, pass_threshold: number /* 50 */,
  immediate_feedback: boolean, allow_skip: boolean, shuffle_choices: boolean,
  questions: [{ _id, type: 'single'|'multiple'|'true_false',
                text, points, choices: [{ _id, text, correct }] }],
  status: 'draft'|'active'|'archived', version: number,
  locked: boolean,                    // true dès le 1er passage → duplication obligatoire
  created_by, created_at, updated_at
}

// questionnaire_attempts
{
  _id, questionnaire_id, questionnaire_version,
    candidate_id, invited_by, token_hash, expires_at,
  status: 'invited'|'in_progress'|'completed'|'expired'|'cancelled',
  started_at?, deadline?, completed_at?, current_index: number,
  device_hash, tab_switch_count: number, is_test_run: boolean,
  answers: [{ question_id, choice_ids, text?, correct, points, answered_at }],
  score: { percentage, points_scored, points_available, passed }
}
```

Le résultat final est **recopié** dans `candidate.classmarker` (+ `classmarker_history`) au format actuel → aucune régression sur la fiche, le PDF, le MCP.

---

## 8bis. Format d'import JSON

```json
{
  "title": "Positionnement NTC",
  "duration_minutes": 20,
  "pass_threshold": 50,
  "immediate_feedback": false,
  "allow_skip": false,
  "questions": [
    { "type": "single", "text": "Que signifie CRM ?", "points": 1,
      "choices": [ { "text": "Customer Relationship Management", "correct": true },
                   { "text": "Central Resource Module", "correct": false } ] },
    { "type": "true_false", "text": "Un devis engage le client.", "points": 1, "answer": false }
  ]
}
```

Validation serveur : taille max (ex. 500 Ko, 200 questions), au moins 1 bonne réponse par QCM, texte brut uniquement (pas de HTML).

## 8ter. Recommandations ajoutées (19/10/2026)

| Changement | Pourquoi |
|---|---|
| ➕ Verrouillage du lien sur 1 appareil | Personne d'autre ne répond pendant les 15 min |
| ➕ Suivi en direct RH (question X/Y, temps restant) | SSE déjà là, utile quand le candidat est en salle |
| ➕ Mode « Tester le questionnaire » | Questions saisies à la main → vérifier avant un vrai candidat |
| ➕ Verrouillage après 1er passage + duplication v2 | Anciens scores jamais faussés, plus simple qu'un snapshot |
| ➕ Compteur de changements d'onglet | Anti-triche minimum, informatif |
| ➕ Enregistrement immédiat de chaque réponse | Zéro perte si coupure |
| ➖ Réponse courte, images | Reportés : coût élevé, peu utile pour du positionnement |
| ➖ Envoi du lien par mail | Inutile avec QR sur place |
| ➖ Stats par question | Plus tard, quand le volume de passages le justifie |
| ✏️ Aléatoire : réponses seulement | Plus simple, même effet anti-copie |
| ✏️ Lien 15 min réglable + régénération 1 clic | 15 min fixe trop court en cas d'imprévu |
| ✏️ Score candidat en % sans « réussi/échoué » | Décision humaine (art. 22 RGPD), pas de candidat découragé avant l'entretien |

## 9. Plan de réalisation

| Phase | Contenu | Livrable | Estimation |
|---|---|---|---|
| **0. Préparation** | Maquettes, saisie des premiers questionnaires | Specs validées | 2-3 j |
| **1. Back cœur** | Extraction `saveTestResult`, schémas, CRUD GraphQL, routes publiques, correction, tests | API testée | 5-7 j |
| **2. Page candidat** | `/test/:token`, accueil, identification, question/page, progression, chrono, fin | Passage complet | 4-5 j |
| **3. Correcteur** | Liste + éditeur questionnaires, liste + détail résultats, renvoi Drive | Outil RH | 5-6 j |
| **4. Branchement CRM** | Modale QR code sur nos questionnaires, statuts sur fiche | Parcours RH bout en bout | 2 j |
| **5. Double run** | Les 2 systèmes en parallèle 2-4 semaines, comparaison des scores | Validation terrain | 2-4 sem. |
| **6. Bascule & nettoyage** | RGPD (registre, politique), coupure ClassMarker, suppression code mort | ClassMarker résilié | 2 j |

---

## 10. Questions à trancher

### Décisions prises (19/10/2026)

- **Q1** → candidats CRM uniquement (fiche candidat Mongo).
- **Q2** → nom + email **pré-remplis depuis le CRM, confirmés** par le candidat (lien unique par candidat).
- **Q3** → feedback correct/incorrect = **option par questionnaire**.
- **Q10** → « importer » = **envoi PDF sur Google Drive** (auto + bouton renvoyer). Import CSV retiré du périmètre.

- **Q4** → score final **affiché** au candidat (écran de fin).
- **Q5** → option par questionnaire `allow_skip` (question passée = 0 point).
- **Q6** → **une seule tentative par lien**. Nouvelle tentative = nouveau lien généré par le RH.
- **Q7** → lien valide **15 minutes** pour commencer (QR scanné sur place). Une fois commencé, c'est la durée du questionnaire qui compte. Le RH régénère un lien si expiré.
- **Q8** → pas de liste figée : éditeur **par blocs** (ajout manuel, bloc = 1 question, choix de type par bloc) + **import JSON** (format §8bis).
- **Q9** → pas d'export ClassMarker : saisie manuelle / JSON.
- **Q11** → Correcteur réservé aux rôles **RH / recrutement** (création, édition, résultats). La lecture du score sur la fiche candidat reste ouverte comme aujourd'hui (AD, GESTION, RH, PEDA, COMMERCIAL).
- **Q12** → existant vérifié dans le code :
  - `passed = percentage >= 50` codé en dur dans `webhook.route.ts` (ClassMarker renvoie `passed=true` même à 35 %).
  - Le **gate** des tests (`front/.../utils/testGateThreshold.ts`) se fait sur la moyenne /20 (écrit + test) : **10 pour CC, 12 pour NTC/REM/AD/SA**.
  - → On garde ce fonctionnement : `pass_threshold` par questionnaire **par défaut 50 %**, le gate par TP n'est pas touché (il lit toujours `classmarker.percentage`).
- **Q13** → questionnaires **propres à chaque région** : collections dans la base régionale via `getModels()`, rien de partagé.
- **Q14** → conservation **comme aujourd'hui** : vérifié, aucun TTL ni purge sur `candidates.classmarker*` ; les résultats vivent avec la fiche et disparaissent seulement si le candidat est supprimé. Même règle pour `questionnaire_attempts` (supprimées avec le candidat). Seules les **invitations jamais commencées et expirées** peuvent être purgées (aucune réponse dedans). ⚠️ À mentionner tel quel dans la politique de confidentialité.
- **Q15** → pas de contrainte de date.

Toutes les questions sont tranchées.
