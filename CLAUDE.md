# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Architecture

Monorepo with three layers:

```
disciplina-app/
├── front/        # React 19 + TypeScript + Vite 8 (scaffold — pas encore implémenté)
├── back/         # Node.js / Express API (non initialisé — README uniquement)
├── database/     # Volume de données MySQL (Docker)
├── schema.sql    # Schéma initial MySQL — monté automatiquement dans le conteneur
└── docker-compose.yaml
```

- **Frontend** : React 19, TypeScript strict, Vite 8 — point d'entrée `front/src/main.tsx`, composant racine `front/src/App.tsx`. TypeScript compilé en mode strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). L'`App.tsx` est actuellement le template Vite par défaut — pas encore implémenté.
- **Backend** : Node.js / Express (principal) + Python (PDF WeasyPrint, NLP, matching) — à initialiser
- **Base de données locale** : MySQL 8.4 via Docker (`schema.sql` chargé automatiquement au démarrage du conteneur via `docker-entrypoint-initdb.d`)
- **Base de données production** : Supabase (PostgreSQL + pgvector + Storage)
- **Réseau Docker** : `back-end` (DB ↔ API) / `front-end` (prévu)

### Schéma BDD actuel (MySQL local — module listing)

Tables dans `schema.sql` (base `listing`) :
- `sector` — code postal + nom du secteur
- `companies` — entreprises (SIRET, adresse, activité principale, FK sector)
- `referents` — contacts entreprise (`LEGAL_REP` ou `RECRUITMENT_MANAGER`, FK company)

### Schéma BDD production (Supabase — module candidat)

| Table | Description |
|-------|-------------|
| `candidat` | Profil complet (infos perso, statut pipeline, CV, RH assigné, vecteur NLP) |
| `document_candidat` | CV, LM, diplômes, pièces d'identité |
| `entretien` | Date, type, notes RH, décision |
| `matching` | Lien candidat ↔ AB (score global + détail JSONB) |
| `notification` | Historique emails/SMS Brevo |
| `conversation_whatsapp` | Historique bot WhatsApp Claude |
| `escalade_rh` | Demandes contact humain depuis le bot |

**Vue :** `vue_pipeline_rh` | **Fonction :** `match_candidats()` (pgvector cosinus)

---

## Commandes

### Docker (base de données locale)

```bash
# Copier et remplir les variables d'environnement
cp .env.example .env

# Démarrer la DB MySQL
docker compose up -d sql-db

# Arrêter
docker compose down

# Voir les logs
docker compose logs -f sql-db
```

### Frontend

```bash
cd front
npm install
npm run dev       # Développement (Vite HMR, port 5173 par défaut)
npm run build     # Build production (tsc -b && vite build)
npm run preview   # Prévisualiser le build de production
npm run lint      # ESLint (typescript-eslint + react-hooks + react-refresh)
```

### Backend (quand initialisé)

```bash
cd back
npm install
npm run dev       # Développement avec hot-reload
npm run start     # Production
npm test          # Tests
```

---

## Contexte projet — Disciplina

**Disciplina** est un Centre de Formation d'Apprentis (CFA) situé à La Réunion, spécialisé en Secrétariat (Bac, Bac+2) et Vente (Bac, Bac+2, Bac+3). Toutes les formations se font en contrat d'apprentissage (4 jours en entreprise, 1 jour école).

**Avantage concurrentiel** : process "entreprise d'abord, candidat ensuite" — seuls 25% des CFA réunionnais le pratiquent.

**Qualiopi** : certification obligatoire pour les CFA (accès subventions État + diplôme via ADEP). Non-négociable. Prochaine inspection : août 2026. Toute fonctionnalité doit faciliter la conformité (traçabilité, émargements, rapports).

### 3 centres
| Centre | Ville | Statut |
|--------|-------|--------|
| Nord (siège) | Sainte-Marie — HUB Lizine | Actif |
| Ouest | Saint-Paul — Savana | Actif depuis 2025 |
| Sud | Saint-Pierre | Ouverture avril 2026 |

### 5 services
| Service | Rôle |
|---------|------|
| **Commercial** | Démarcher et trouver des entreprises partenaires |
| **RH** | Trouver et positionner les candidats sur les AB |
| **Administratif** | Contractualiser apprenants + entreprises + financements |
| **Pédagogie** | Suivi des apprentis durant la formation |
| **Direction** | Coordination de tous les services, gestion externe |

---

## Mon rôle — Développeur prestataire

Fournir à Disciplina :
1. **Un intranet** — outil de gestion interne pour les 5 services
2. **Une interface web** — page entreprise (AB en ligne) + page RH (backoffice matching)
3. **Un bot WhatsApp** — pour les candidats sélectionnés (IA conversationnelle)

---

## L'Analyse de Besoin (AB)

Document central du process commercial → RH :

- **Identité entreprise** : raison sociale, SIRET, secteur, adresse
- **Représentant légal** : nom, prénom, fonction, email, téléphone
- **Responsable de recrutement** (peut différer du représentant légal)
- **Poste à pourvoir** : intitulé, missions, tableau de tâches
- **Profil apprenti** : domaine, niveau (Bac/Bac+2/Bac+3), âge souhaité, permis B
- **Méthode de recrutement préférée**, jours de formation possibles, centre rattaché
- **Mandat** (optionnel) : autorisation de chercher un candidat → déclenche publication auto Koann

Process papier actuel à remplacer : envoi papier → scan → numérisation → renvoi → saisie CSV. Objectif : dématérialisation totale + signature YouSign + RGPD 100%.

---

## Détail des services à digitaliser

### Commercial

- **Listing** : 65 000 entreprises à La Réunion — recherche manuelle = 20% du temps commercial. Objectif : auto-complétion depuis sources (listing Lorenzo, Pages Jaunes, France Travail, LinkedIn). Évolution : newsletter automatique + déduction IA du type de candidat recherché.
- **Prospection** → AB en ligne (mobile-friendly, brouillon possible) → YouSign → relance automatique si non signé → notification RH
- **Back-office** : historique prospection, campagnes mail automatisées (Brevo), formats de notation standardisés

### RH

**Vivier candidats** : collecte CV multicanal (France Travail, Missions Locales, Koann, réseaux) → sélection (secteur, âge) → tests automatiques → entretien → intégration auto BDD → déclenchement bot WhatsApp

**Positionnement sur AB** : AB signé reçu → pré-matching NLP auto (pgvector) → validation RH → mail candidats → acceptation → mail entreprise → choix final entreprise

### Pédagogie

- **Convocations** : envoi automatique dès contrat signé
- **Émargements** : 1 absence → mail justification apprenti + mail entreprise + récap mensuel
- **Conseil de classe** : tous les 3-4 mois, docs dématérialisés, envoi J-7
- **Enquêtes satisfaction** : à chaud + à froid → rapport automatique

### Direction

- **GPT spécial Disciplina** : IA locale déployée pour les gérants (questions internes)
- Tableau de bord global (KPIs tous services)

---

## Stack technique validée

| Couche | Technologie |
|--------|-------------|
| **Front** | React 19 + TypeScript + Vite |
| **Back principal** | Node.js / Express |
| **Back secondaire** | Python (PDF WeasyPrint, NLP, matching) |
| **BDD** | Supabase (PostgreSQL + pgvector + Storage) |
| **Signature** | YouSign API |
| **Gestion formation** | Digiforma (existant — ne pas dupliquer) |
| **Bot WhatsApp** | Twilio (WhatsApp Business API) |
| **LLM** | Claude (Anthropic API) |
| **Emails + SMS** | Brevo |
| **Publication offres** | Koann (API) |

---

## Charte graphique

| Hex | Rôle |
|-----|------|
| `#1A1AE6` | Bleu primaire — boutons, liens |
| `#6B2FD9` | Violet — secondaire, hover, badges |
| `#1565C0` | Bleu foncé — états actifs |
| `#E91E8C` | Rose/Magenta — alertes, notifications |
| `#00BCD4` | Cyan — succès, statuts positifs |
| `#F2F2F2` | Gris clair — fonds, cartes |
| `#1A1A2E` | Bleu nuit — sidebar, navbar |
| `#FFFFFF` | Blanc — fond principal |

---

## Ordre de développement prévu

| # | Module |
|---|--------|
| 1 | SQL Supabase — toutes les tables |
| 2 | Auth + rôles (commercial / RH / pédago / admin / direction) |
| 3 | Formulaire AB (mobile-friendly, brouillon, YouSign) |
| 4 | Intégration YouSign (envoi + webhook) |
| 5 | Dashboard commercial (pipeline + relances + listing automatisé) |
| 6 | Espace RH — vivier candidats (kanban + collecte CV) |
| 7 | Espace RH — matching NLP (algo positionnement AB) |
| 8 | Espace Pédago (convocations, émargements, conseils, enquêtes) |
| 9 | Interface web entreprise (formulaire AB public) |
| 10 | Bot WhatsApp (Twilio + Claude + escalade) |
| 11 | GPT Direction (IA locale Disciplina) |

---

## Décisions & points importants

- **Qualiopi non négociable** — toute fonctionnalité doit faciliter la conformité
- **Process unique** : entreprise d'abord → candidat ensuite
- **Dématérialisation AB** = priorité absolue
- **Digiforma** déjà utilisé — éviter les doublons, prévoir intégration ou cohabitation
- **Salesforce** possible pour la prospection, l'AB reste dans l'intranet (connexion webhook)
- **Matching NLP** via pgvector Supabase (similarité cosinus)
- **Service administratif** à cadrer en détail (contractualisation + financements)
