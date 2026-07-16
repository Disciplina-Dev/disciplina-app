# Veille réglementaire DISCIPLINA — FreshRSS auto-hébergé

Système de veille **gratuit et 100 % auto-hébergé** pour DISCIPLINA (CFA /
organisme de formation, La Réunion, certifié **Qualiopi**). Basé sur
[FreshRSS](https://freshrss.org/) en local via Docker, base **SQLite**.

Objectif : surveiller OPCO, France Compétences, Centre Inffo et sources
réglementaires de la formation professionnelle pour alimenter la veille Qualiopi
(**indicateurs 23, 24, 25**). FreshRSS = tableau de bord de veille **daté et
historisé** → preuve devant l'auditeur. Voir [docs/QUALIOPI.md](docs/QUALIOPI.md).

Config 100 % par variables d'environnement → **portable** du poste local vers un
VPS sans rien changer en dur.

## Prérequis

- Docker
- Docker Compose

## Démarrage rapide

```bash
cd veille/rss
cp .env.example .env        # ajuster TZ / port / cron au besoin
docker compose up -d
```

Puis ouvrir **http://localhost:8080** et suivre l'assistant (SQLite + compte
admin + import des OPML). Détails : [docs/INSTALL.md](docs/INSTALL.md).

## Sources surveillées

> Constat de juin 2026. Les OPCO n'exposent pas de flux RSS natif → scraping
> XPath (voir [docs/XPATH.md](docs/XPATH.md)).

| Source | Catégorie | Flux RSS ? |
|--------|-----------|------------|
| Centre Inffo — Le Quotidien de la formation | Réglementaire | ✅ `.../le-quotidien.../feed` |
| Centre Inffo — Réforme | Réglementaire | ✅ `https://www.centre-inffo.fr/category/site-reforme/feed` |
| Centre Inffo — Droit de la formation | Réglementaire | ✅ `.../site-droit-formation/actualites-droit/feed` |
| Centre Inffo — Europe & international | Réglementaire | ✅ `.../actualites-europe/feed` |
| Centre Inffo — Innovation formation | Pédagogie | ✅ `.../innovation-formation/feed` |
| Centre Inffo — Régions | Pédagogie | ✅ `.../actualites-regions/feed` |
| Via Compétences — Actualités | Pédagogie | ✅ `https://www.via-competences.fr/rss-actualites.xml` |
| OPCO.fr — agrégateur actus | OPCO | ⚠️ `/feed` à confirmer (sinon XPath) |
| France Compétences | Réglementaire | ❌ → XPath |
| Ministère du Travail (formation pro) | Réglementaire | ❌ → XPath |
| Légifrance (textes formation / JORF) | Réglementaire | ❌ → XPath (ou outil tiers Legifrss) |
| AFDAS | OPCO | ❌ → XPath |
| AKTO | OPCO | ❌ → XPath |
| ATLAS | OPCO | ❌ → XPath |
| Constructys | OPCO | ❌ → XPath |
| OCAPIAT | OPCO | ❌ → XPath |
| L'Opcommerce | OPCO | ❌ → XPath |
| OPCO 2i | OPCO | ❌ → XPath |
| OPCO EP | OPCO | ❌ → XPath |
| OPCO Mobilités | OPCO | ❌ → XPath |
| OPCO Santé | OPCO | ❌ → XPath |
| Uniformation | OPCO | ❌ → XPath |

Les sources ✅ sont pré-emballées en OPML dans `feeds/opml/` (import en un clic).
Les sources ❌ se branchent en XPath : URLs + sélecteurs de départ dans
[docs/XPATH.md](docs/XPATH.md).

## Organisation recommandée (dossiers FreshRSS)

- **Reglementaire** → indicateur 23 (veille légale/réglementaire)
- **OPCO** → indicateur 24 (métiers & compétences)
- **Pedagogie** → indicateurs 24/25 (innovation pédagogique & technologique)

Les trois OPML créent automatiquement ces catégories.

## Rafraîchissement automatique

`CRON_MIN=*/30` → FreshRSS actualise les flux **toutes les 30 minutes**.
⚠️ La machine (ou le VPS) doit **rester allumée** et le conteneur tournant pour
que la veille s'historise en continu — c'est la continuité du journal qui fait
preuve à l'audit.

## Arborescence

```
rss/
├── docker-compose.yml
├── .env.example
├── .gitignore          # ignore ./data (DB SQLite + secrets)
├── README.md
├── feeds/
│   └── opml/
│       ├── opco.opml
│       ├── reglementaire.opml
│       └── pedagogie.opml
└── docs/
    ├── INSTALL.md      # install pas à pas
    ├── XPATH.md        # scraper les sites sans flux RSS
    └── QUALIOPI.md     # couverture indicateurs 23/24/25
```

## Aller plus loin

- **Notifications par mail** : ajouter plus tard un conteneur
  [rss2email](https://github.com/rss2email/rss2email) ou l'extension FreshRSS
  *Email notifications* pour recevoir les nouveaux articles par mail.
- **Déploiement VPS** : la config étant 100 % en variables d'env, il suffit de
  copier le dossier, ajuster `.env` (port, TZ) et `docker compose up -d`. Penser
  à mettre un reverse-proxy HTTPS (Caddy / Traefik) devant le port.
- **Sauvegarde** : planifier une copie régulière du dossier `./data`.
