# Suite E2E Playwright

Automatise les flux critiques du référentiel [`../../../E2E.md`](../../../E2E.md) (3.1 → 3.16) via des parcours navigateur réels sur `:5173` → back `:4000`.

## Prérequis

1. **Stack complète démarrée**, avec le seed E2E (users par rôle) **et le rate limiter de login désactivé** :
   ```sh
   E2E_DISABLE_LOGIN_RATE_LIMIT=true docker compose up
   ```
   Le seed `database/mysql/mysql-seed-e2e.sql` crée les comptes de test (mot de passe commun `E2ePassw0rd!`) :
   `commercial@e2e.test`, `rh@e2e.test`, `peda@e2e.test`, `admin@e2e.test`.

   > ⚠️ **`E2E_DISABLE_LOGIN_RATE_LIMIT=true` est obligatoire.** Chaque run enchaîne 4 logins de setup + les logins des specs ; sans le flag, le plafond `loginRateLimiter` (10/15 min par IP) renvoie `429` et les redirections échouent. Le flag est ignoré en production (`NODE_ENV=production`). Si le backend tourne déjà, le recréer :
   > ```sh
   > E2E_DISABLE_LOGIN_RATE_LIMIT=true docker compose up -d backend
   > ```

2. **Navigateurs Playwright** (une fois) :
   ```sh
   npx playwright install --with-deps
   ```

## Lancer

```sh
npm run test:e2e        # tous les flux
npm run test:e2e:ci     # exclut les tests taggés @external (déterministe en CI)
npm run test:e2e:ui     # mode UI interactif
```

Rapport HTML : `playwright-report/`.

## Architecture

| Dossier | Rôle |
|---|---|
| `setup/auth.setup.ts` | Login réel via UI pour chaque rôle → `e2e/.auth/<role>.json` (storageState, cookies httpOnly) |
| `fixtures/roles.ts` | Comptes de test, URLs `home`, chemins storageState, `API_URL` |
| `fixtures/mocks.ts` | `mockExternal()` / `mockSignedToken()` — interception réseau des services tiers |
| `fixtures/csrf.ts` | Header `x-csrf-token` pour les requêtes REST state-changing |
| `tests/*.spec.ts` | Un spec par flux, nommé d'après E2E.md (+ `portefeuille.spec.ts` : CRM commercial, hors numérotation E2E.md) |

## Couverture des flux

Les 16 flux numérotés de E2E.md (3.1 → 3.16) ont chacun leur spec. S'y ajoute le CRM commercial, non numéroté dans E2E.md (décrit au §2 « Rôles × espaces ») :

| Spec | Périmètre | Rôle | External |
|---|---|---|---|
| `portefeuille.spec.ts` | Portefeuille entreprises (liste + recherche nom/SIRET), ouverture du formulaire « Nouvelle fiche », liste noire | commercial | non |

> Les routes commerciales `sourcing`, `analyses-besoin`, `mail`, `relance` et `todos` sont couvertes par leurs specs de flux respectifs (`sourcing`, `needs-analysis`, `email-relance`, `notifs-todos`). `portefeuille.spec.ts` complète le cœur CRM (portefeuille + fiche entreprise + liste noire) qui n'était rattaché à aucun flux numéroté.

### Formulaires d'écriture — rendu + validation client

Les parcours d'écriture (création candidat/utilisateur, modification entreprise/candidat) sont couverts **au niveau rendu du formulaire et validation côté client uniquement** — les tests ne soumettent jamais en base. La persistance reste couverte par les tests component du back. Conséquence : aucune pollution des données seedées, aucun teardown, aucun tag `@external` (les services tiers ne sont sollicités qu'à la soumission, jamais atteinte).

| Spec | Parcours | Vérification |
|---|---|---|
| `candidats.spec.ts` | Création candidat (RH) | ouverture du modal, champs requis présents, submit à vide ne quitte pas le modal, « Annuler » ferme le modal |
| `candidats.spec.ts` | Modification candidat (RH) | fiche pré-remplie dans le modal d'édition |
| `candidats.spec.ts` | Garde de rôle (RH) | accès à l'espace admin → `ProtectedRoute` redirige vers `/rh/candidats` |
| `admin-users.spec.ts` | Création utilisateur (GESTION) | mots de passe divergents → message d'erreur ; email malformé → submit HTML5 bloqué ; aucune création |
| `portefeuille.spec.ts` | Création entreprise (commercial) | formulaire manuel : champs requis → « Champ obligatoire » ; SIRET invalide → erreur de format (react-hook-form, sans appel INSEE) |
| `portefeuille.spec.ts` | Modification entreprise (commercial) | édition inline → barre « Modifications non enregistrées » |

> Les tests d'**édition** (candidat, entreprise) dépendent de données seedées : ils se `skip` proprement si aucun enregistrement (ou aucune fiche éditable) n'est présent. La validation du SIRET n'appelle l'INSEE (`@external`) que sur un SIRET valide de 14 chiffres au submit — les tests utilisent un SIRET invalide, donc restent déterministes hors ligne.

## Conventions

- **Sélecteurs** : rôle/label/texte uniquement (aucun `data-testid` dans le front). Pas de `waitForTimeout`.
- **Auth** : cookies httpOnly capturés en storageState ; l'app réhydrate via `GET /api/auth/me`.
- **Tag `@external`** : tout test touchant/mockant un service tiers (Google, INSEE, Ollama, DocuSeal, ClassMarker) ou un token signé. Exclus par `test:e2e:ci`.
- **ENTREPRISE** : rôle invité JWT-only (pas de user en base) → couvert par token mocké (`mockSignedToken`).

## Calibration au premier run

Certaines assertions (payloads de mock dans `fixtures/mocks.ts`, contenus de rejet des parcours publics) sont calées sur les contrats API documentés dans E2E.md et doivent être affinées au premier run contre la stack réelle. Lancer d'abord `npm run test:e2e:ci` (déterministe), puis ajuster les specs `@external`.
