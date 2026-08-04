# Politique de cookies et traceurs

**Version [[VERSION_DOC]] — dernière mise à jour : [[DATE_MAJ]]**

Cette politique décrit les cookies et autres traceurs déposés lors de
l'utilisation de l'application [[URL_APP]], en application de l'article 82 de la
loi n° 78-17 du 6 janvier 1978 modifiée.

Elle complète la [politique de confidentialité](/legal/confidentialite).

---

## 1. Qu'est-ce qu'un traceur ?

Un traceur est un fichier ou une information déposée puis lue sur votre terminal
lors de la consultation d'un site. Il peut s'agir d'un cookie, mais aussi d'un
espace de stockage local du navigateur (*local storage*, *session storage*).

Certains traceurs sont **strictement nécessaires** au fonctionnement du service :
ils sont dispensés de consentement. Les autres ne peuvent être déposés qu'avec
votre accord, sauf lorsqu'ils relèvent d'une mesure d'audience strictement limitée.

## 2. Traceurs strictement nécessaires

Ces traceurs sont indispensables à l'authentification, à la sécurité et au
fonctionnement de l'application. Leur dépôt ne requiert pas votre consentement et
ils ne peuvent pas être désactivés sans rendre le service inutilisable.

| Nom | Type | Finalité | Durée |
|---|---|---|---|
| `disc_at` | Cookie, `HttpOnly` | Jeton d'accès : maintien de la session authentifiée | Session courte (quelques minutes), renouvelé automatiquement |
| `disc_rt` | Cookie, `HttpOnly` | Jeton de renouvellement : évite une reconnexion à chaque expiration du jeton d'accès | Jusqu'à 30 jours |
| `disc_csrf` | Cookie | Protection contre la falsification de requêtes intersites (CSRF) | Durée de la session |
| `connect.sid` | Cookie, `HttpOnly` | Identifiant de session serveur, utilisé notamment lors des connexions via un fournisseur d'identité | 24 heures |
| Stockage local applicatif | *Local storage* | Mémorisation de préférences d'affichage et de l'accusé de lecture du présent avis | Jusqu'à effacement par vos soins |

Ces traceurs ne sont pas utilisés à des fins publicitaires et ne font l'objet
d'aucun croisement avec des données provenant d'autres sites.

## 3. Traceur de supervision technique — Sentry

L'application utilise **Sentry** afin de détecter et de diagnostiquer les erreurs
techniques et les problèmes de performance.

| Élément | Détail |
|---|---|
| Éditeur | Functional Software, Inc. (Sentry) |
| Localisation du traitement | Union européenne — instance allemande |
| Finalité | Détection des erreurs, mesure de performance, diagnostic |
| Base légale | Intérêt légitime de [[NOM_ORGANISME]] à assurer le bon fonctionnement et la sécurité du service |
| Durée de conservation | 30 jours |

### Ce que Sentry collecte

- **Rapports d'erreur** : message et pile d'appel de l'erreur, page concernée,
  type et version du navigateur, système d'exploitation, adresse IP.
- **Traces de performance** : durée des requêtes réseau et des rendus.
- **Journaux applicatifs** : messages techniques émis par l'application.
- **Enregistrements de session** (*session replay*) : reconstitution des
  interactions à l'écran (navigation, clics, saisies, contenus affichés). Ces
  enregistrements sont échantillonnés : environ **10 % des sessions** et
  **les sessions au cours desquelles une erreur survient**.

### Ce que cela implique

Un enregistrement de session peut contenir des données personnelles affichées à
l'écran au moment de la navigation. Les champs de mot de passe sont exclus par le
mécanisme de masquage de l'outil.

> **Point de transparence.** [[NOM_ORGANISME]] a identifié que la configuration
> actuelle des enregistrements de session doit être resserrée : réduction du
> périmètre des données collectées, extension du masquage aux champs sensibles et
> mise en place d'un recueil de consentement préalable. Ces travaux sont engagés.
> Dans l'intervalle, toute personne peut demander l'exclusion de ses sessions ou
> la suppression des enregistrements la concernant en écrivant à [[EMAIL_DPO]].

### Comment s'y opposer

- **Depuis votre navigateur** : la plupart des bloqueurs de traceurs et
  l'activation du signal « Do Not Track » empêchent le chargement de Sentry.
- **Sur demande** : écrivez à [[EMAIL_DPO]] pour demander l'exclusion de votre
  compte du dispositif ou la suppression des enregistrements vous concernant.

Le refus de Sentry n'empêche pas l'utilisation de l'application.

## 4. Services tiers ouverts depuis l'application

Certaines fonctionnalités renvoient vers des services tiers qui déposent leurs
propres traceurs, régis par leurs propres politiques :

| Service | Contexte |
|---|---|
| Google | Connexion via un compte Google, consultation de documents hébergés sur Drive, agenda |
| DocuSeal | Signature électronique de documents |
| ClassMarker | Passage des évaluations en ligne |

[[NOM_ORGANISME]] n'a pas la maîtrise des traceurs déposés par ces services. Il
est recommandé de consulter leurs politiques respectives.

## 5. Absence de publicité et de mesure d'audience commerciale

L'application ne dépose **aucun cookie publicitaire**, aucun traceur de réseau
social et aucun outil de mesure d'audience à finalité commerciale. Aucune donnée
n'est transmise à des régies publicitaires.

## 6. Paramétrer votre navigateur

Vous pouvez configurer votre navigateur pour accepter, refuser ou supprimer les
cookies. Le refus des traceurs strictement nécessaires rendra toutefois
l'authentification impossible.

- **Chrome** — Paramètres › Confidentialité et sécurité › Cookies
- **Firefox** — Paramètres › Vie privée et sécurité › Cookies et données de sites
- **Safari** — Réglages › Confidentialité
- **Edge** — Paramètres › Cookies et autorisations de site

## 7. Vos droits

Vous disposez de droits d'accès, de rectification, d'effacement, de limitation et
d'opposition sur les données collectées au moyen de ces traceurs. Ils s'exercent
auprès de **[[EMAIL_DPO]]**.

Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).

## 8. Modification de la présente politique

La présente politique est mise à jour à chaque évolution des traceurs utilisés. La
version en vigueur est celle publiée à l'adresse [/legal/cookies](/legal/cookies).
