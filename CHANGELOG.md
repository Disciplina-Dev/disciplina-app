# Changelog

Ce fichier retrace les évolutions de l'application Disciplina, version par version.
Il est mis à jour **manuellement**, à chaque fusion de branche sur `main`.

> ⚠️ **Synchronisation** : l'application lit une copie de ce fichier dans
> `front/disciplina-front/src/content/CHANGELOG.md`. À chaque modification,
> penser à reporter les changements dans cette copie avant de déployer le front.

## Conventions

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

- Une section par version : `## [x.y.z] - AAAA-MM-JJ`, précédée d'une section
  `## [Unreleased]` qui regroupe les changements en attente de déploiement.
- Les changements sont répartis en catégories :
  - `### Added` — nouvelles fonctionnalités.
  - `### Changed` — modifications de l'existant.
  - `### Deprecated` — fonctionnalités appelées à disparaître.
  - `### Fixed` — corrections de bugs.
  - `### Security` — correctifs de sécurité.
- Versionnement sémantique `major.minor.patch` :
  - **Major** : changement cassant (suppression ou rupture de comportement d'une
    fonctionnalité, changement d'API).
  - **Minor** : nouvelle fonctionnalité rétrocompatible.
  - **Patch** : correction de bug.
- À chaque déploiement : renommer `## [Unreleased]` en `## [x.y.z] - AAAA-MM-JJ`
  (incrément selon les règles ci-dessus), puis ouvrir une nouvelle section
  `## [Unreleased]` vide.

## [Unreleased]

### Added

- Propositions de matching sur la fiche candidat (#1254) : un encadré repliable liste les offres proposées au candidat via le matching avec sa réponse — « Oui », « Non » ou « En attente » — et un récapitulatif du nombre de réponses. Il reste discret et masqué tant qu'aucune proposition n'existe.
- Calendrier RH — créneaux partagés entre RH d'un même secteur (#1241) : un entretien posé sur l'agenda d'un RH (créneau « Entretien » créé depuis le calendrier, rendez-vous pris via le lien de réservation publique, ou créneau d'entretien réservé par un candidat) bloque désormais ce créneau pour tous les RH partageant au moins un secteur avec lui. Le créneau n'est plus proposé sur leur page de réservation, il apparaît « pris » sur la page de créneaux candidat, et il s'affiche en gris (cadenas) dans la vue mois/semaine du calendrier, avec le nom du RH concerné. Poser un entretien sur un créneau déjà pris par un collègue du secteur est refusé ; supprimer ou reporter l'entretien libère le créneau. Le rattachement au secteur est recalculé à la lecture : un changement de secteur suit les blocages du nouveau secteur.
- Journal d'accès aux fiches candidats (GDPR_INF_06.5, F14) : chaque consultation de fiche, liste en masse, démasquage du NIR, export PDF AB, téléchargement du CV et lecture des fichiers Drive est désormais enregistré (qui, quand, quelle opération ; identifiant de fiche uniquement, aucun contenu) dans `candidate_access_log`, conservé 365 jours. Nouvelle requête GraphQL `candidateAccessLog(candidateId)` réservée aux RESPONSABLE et ADMIN pour répondre à une demande d'accès d'un candidat. Hors périmètre : miniatures d'avatar et PDF de questionnaires. Politique de confidentialité mise à jour.
- Historique et retrait des consentements candidats (GDPR_INF_08.2, #1141) : chaque octroi ou retrait de consentement (traitement, partage, IA, photo) est désormais conservé avec sa date, la version du texte et l'auteur, dans une table dédiée en ajout seul. Depuis la fiche candidat, la section « Retrait et historique des consentements » affiche cet historique et permet de retirer un consentement à la demande du candidat, avec effet immédiat (ex. retrait du consentement IA : la fiche sort de l'assistant IA). La date de consentement est maintenant fixée par le serveur et la version du texte est contrôlée. Reprise des consentements existants automatique au déploiement (`deploy.sh`, voir `HOWTODEPLOY.md`).
- Report d'un entretien (#1076) dans le calendrier RH : le bouton « Reporté » d'un entretien demande désormais la nouvelle date et l'heure, puis déplace réellement le créneau (les KPI « entretien placé » et « reporté » suivent la nouvelle date). Un créneau non-entretien garde le marquage direct.
- Questionnaires internes (#968), remplaçants de ClassMarker : éditeur par blocs (QCM 1 ou plusieurs réponses, vrai/faux, réponse libre corrigée automatiquement), import/export JSON, mode « Tester », verrouillage après le 1er passage + duplication en v2 ; lien unique + QR depuis la fiche candidat, page candidat `/test/:token` (une question par page, chrono serveur, pas de retour arrière, lien lié au 1er appareil), suivi en direct sur la fiche ; résultats filtrables (export CSV, détail réponse par réponse) et téléchargement direct du PDF des résultats, sans compte Google. Questionnaires ClassMarker repris dans `Classmarker/questions/jsons/`.
- Tableau de bord RH (#1036) : le KPI « En immersion » est cliquable et ouvre la liste complète des candidats en immersion (candidat, entreprise d'accueil, début, fin, n° de convention, échéance), comme « En contrat ».
- Blocage de dates dans le calendrier RH (#1080) : depuis le calendrier, « Bloquer des dates » retire un jour des créneaux proposés sur la page de réservation, quelles que soient les disponibilités hebdomadaires. Choix de la portée (« pour moi » seul, ou « pour tout le monde » pour tous les RH) avec motif obligatoire ; blocage visible directement dans les vues mois/semaine et annulable à tout moment. Un blocage « pour tout le monde » peut être annulé « pour moi » (dérogation personnelle, re-bloquable) ou « pour tout le monde ».
- Blocage de dates étendu (#1206) : le blocage du calendrier RH couvre désormais une période (« du … au … »), saisie en une fois et affichée comme une seule entrée. Les portées deviennent « Moi », « Mon secteur » (les RH des secteurs choisis, adhésion recalculée à la lecture), « Tout le monde », ou « + » pour cocher des personnes une à une. L'annulation porte sur toute la période : « pour moi » (dérogation personnelle, réservée aux personnes que le blocage concerne) ou « pour tout le monde », réservée à l'auteur du blocage et aux responsables/admin ; elle n'emporte que ce blocage, les autres blocages du même jour survivent. L'auteur d'un blocage nominatif est le seul à voir les noms des personnes ciblées (les autres ne voient qu'un nombre), et réécrire le blocage d'un autre RH est refusé. Les routes mono-jour restent supportées.
- Annuaire entreprises (#1190) : le statut Actif/Inactif est désormais propre à chaque offre au lieu d'être porté par l'AB — une même AB peut contenir des offres actives et des offres inactives. Par défaut une offre suit le statut de son AB (« Automatique ») ; le statut se règle offre par offre dans la modale et depuis la page matching de l'AB, et les filtres « Statut » / « Actives uniquement » s'appliquent aux offres.
- Formulaire AB (#1224) : la liste « Secteur(s) d'activité » s'enrichit de 18 secteurs d'activité entreprise (administration publique, éducation/formation, comptabilité, banque/finance, recrutement, juridique, transport, hôtellerie/tourisme, communication, informatique, industrie, agriculture, services, coiffure/esthétique, culture, environnement, commerce de gros), en complément des secteurs historiques. Le champ libre « Autre secteur d'activité » reste disponible pour les préciser.
- Accès direct à l'AB archivée sur le Drive : depuis la liste de matching RH, l'en-tête d'une AB et les listes d'AB du portefeuille commercial, un bouton « Ouvrir l'AB dans le Drive » ouvre le PDF archivé (la copie signée lorsque l'AB est signée). Le lien est mémorisé à l'archivage ; les AB antérieures sont retrouvées à la demande, avec repli sur le dossier Drive si le fichier n'est pas identifiable.
- Matching — réponses de l'entreprise (#1250) : lorsqu'une entreprise demande un entretien ou désigne un « coup de cœur » depuis le lien de proposition, toute l'équipe RH reçoit désormais une notification in-app (en plus de la To-Do « Organiser l'entretien »). Elle précise l'entreprise et le candidat concernés et renvoie vers la page de matching de l'offre.

### Changed

- Consentement « traitement par IA » de la fiche candidat (GDPR_INF_05.5, #1131) : le libellé couvre désormais, en plus du résumé de profil par l'IA locale, l'utilisation par l'équipe d'un assistant IA tiers (traitement possible hors UE) ; politique de confidentialité mise à jour en conséquence. Version des consentements portée à `2026-11-v2` (constante partagée `src/constants/consent.ts`) ; les consentements déjà recueillis sont conservés avec leur version d'origine.
- KPI entretiens du calendrier RH (#1076) : un même email d'invité ne compte qu'une fois — seul son premier rendez-vous (par date de début) crédite « entretien placé » et la catégorie de présence (venu, pas venu, reporté, décliné), pour ne plus cumuler deux catégories pour un même candidat.
- Résultats de test (#968) : la logique du webhook ClassMarker est extraite dans `TestResultService` ; les résultats internes sont écrits au même format (`candidate.classmarker` / `classmarker_history`, `source: 'internal'`), donc fiche, gate, PDF et MCP sont inchangés. ClassMarker reste branché pendant la transition.
- Horaires d'immersion (#1035) : chaque jour activé peut porter deux plages facultatives (matin et après-midi) pour deux shifts le même jour ; toutes les heures restent optionnelles, une fin de matinée ou un début d'après-midi absents ne bloquent pas l'enregistrement, et les créneaux continus existants sont relus sans migration.
- Annuaire entreprises du tableau de bord RH (#1043) : une ligne par offre — une entreprise portant plusieurs offres apparaît désormais plusieurs fois, avec une colonne « Offre » (statut) et l'historique propre à chaque offre. La liste charge maintenant toutes les analyses de besoins en arrière-plan, ce qui fait réapparaître les entreprises actives anciennes (offres « CV envoyé », « Matché », « En contrat ») qui sortaient de la fenêtre des 500 premières lignes.
- Matching — « Mail à tous » (#1251) : une option permet d'inclure ou non les candidats déjà contactés (mail d'offre déjà envoyé, y compris ceux qui ont décliné). Par défaut ils sont exclus pour éviter les doublons d'envoi ; le bouton affiche le nombre de destinataires effectifs.

### Fixed

- Matching automatique (#1254) : « Envoyer un mail » enregistre désormais le match avant l'envoi. Sans cela, un candidat retenu via le matching automatique pouvait cliquer « Oui » dans le mail et voir la page de confirmation sans qu'aucune réponse n'apparaisse sur la page Matching. Un lien de réponse qui ne correspond à aucun candidat de l'offre affiche maintenant un message d'erreur au lieu d'une fausse confirmation.
- Mails « Nouvelle Analyse du Besoin » (#1231) : l'envoi aux RH ne dépend plus d'un compte Google unique (`dev@disciplina.re`) qui pouvait disparaître en silence (compte supprimé, boîte absente d'un tenant, jeton révoqué puis purgé). La boîte d'envoi est configurable par tenant (`SYSTEM_MAIL_SENDER`) et, si elle est indisponible, le mail part depuis un compte du staff connecté (responsable, RH, gestion, commercial) avec une alerte dans les logs ; plus aucun mail système n'est perdu sans trace. Voir `HOWTODEPLOY.md` → *System mail mailbox*.
- Offres correspondantes de la fiche candidat (#1188) : une offre désactivée dans l'annuaire entreprises (« Inactive ») n'est plus proposée au candidat — ni dans les suggestions automatiques, ni dans la recherche « Proposer des offres », ni même lorsqu'elle lui avait déjà été assignée. Les offres en statut « Automatique » continuent de suivre le statut de leur AB.
- Prise de rendez-vous (#1191) : un entretien réservé par un candidat via le lien de calendrier d'un RH est désormais un vrai entretien (marquage « entretien », nom/prénom/email de l'invité enregistrés sur le créneau). « Venu » ouvre la création de la fiche candidat pré-remplie, le report et la relance « pas venu » sont disponibles, et le rendez-vous compte dans les KPI RH (« entretien placé », puis venu / pas venu / reporté / décliné).
- Matching automatique (#1252) : cliquer sur « Non » pour une suggestion est désormais enregistré sur l'offre (`matching.dismissed_candidate_ids`) ; le candidat écarté ne réapparaît plus après rechargement de la page ni après relance du matching.
- Matching par secteur d'activité (#1066) : une offre ne propose plus que les candidats ayant coché l'un de ses secteurs ; le repli qui affichait tous les candidats quand aucun ne correspondait est supprimé. Le rapprochement compare désormais les secteurs du référentiel en tolérant les codes et libellés historiques (`COMMERCIAL` ≡ « Commerce / Vente »), et s'applique aussi aux « Offres correspondantes » de la fiche candidat. Les secteurs saisis librement dans l'AB restent ignorés faute d'équivalent candidat, avec un avertissement explicite.
- Annuaire entreprises (#1249) : le filtre « Zone » s'appuie désormais sur les communes de chaque offre au lieu du seul secteur de l'AB. Une entreprise dont les offres couvrent plusieurs secteurs (Nord-Est, Ouest, Sud) est donc filtrée offre par offre, et le récapitulatif « Par secteur » compte chaque offre dans ses zones réelles (une offre multi-zones apparaît dans chaque colonne sans gonfler la colonne « Total »). Une offre sans localisation retombe sur le secteur de son AB.

### Security

- Questionnaires internes (#968) : jeton de lien de 256 bits stocké haché, bonnes réponses jamais envoyées au navigateur avant validation, route publique limitée en débit ; RGPD : passages supprimés avec le candidat, invitation jamais commencée purgée à expiration, `tab_switch_count` jamais transmis au MCP.

## [1.5.0] - 2026-10-21

### Added

- MCP RGPD (#915) : consentement `ai_processing` appliqué aux outils candidats/offres, DTO minimisés, journal d'accès `mcp_audit_log`, quotas par utilisateur, clé statique `MCP_STATIC_KEY_ENABLED` désactivée en production par défaut, `MCP_JWT_SECRET` distinct, purge OAuth/audit planifiée.
- MCP péda (#930) : 12 outils lecture seule (sessions, SA, alternants « Prénom N. », ruptures, KPI) minimisés RGPD ; `contactsComplete` sur les SA en retard / à venir.
- Agenda des SA (#957) : les séquences d'accompagnement (SA) sont synchronisées sur l'agenda Google de chaque Peda connecté (événement journée entière tagué) ; vue « Calendrier » à côté de la liste des SA, réconciliation Google → app à l'ouverture de la liste comme du calendrier (et via « Synchroniser ») : déplacer un événement Google replanifie la SA, et la date d'une SA est aussi modifiable depuis la fiche alternant.
- Publication d'un brouillon d'AB dans le matching (#918) : option « visible dans le matching » sur la modale AB (affichée « Non envoyée »), champ `isVisibleInMatching` et mutation `setNeedsAnalysisMatchingVisibility` ; les offres sont créées/supprimées sans envoi en signature, sans doublon au premier envoi.
- Jour de formation sur le dashboard péda (#919) : affiché pour les SA en retard et à venir (recherche incluse), avec repli silencieux si la session est indisponible.
- Suivi entreprise dans l'annuaire RH (#926) : colonnes éditables « France Travail » et « KOANN » (`updateNeedsAnalysisTracking`) et correction manuelle de la date d'activation (`updateNeedsAnalysisActivationDate`).
- Sourcing multi-critères des entreprises (#951) : recherche via l'API `recherche-entreprises.api.gouv.fr` (commune, département, région, dirigeant, état, activité, catégorie, effectif) en complément de SIRENE, avec pagination et limitation de débit.
- Planning le week-end (#953) : samedi et dimanche disponibles dans les horaires du poste (AB) et d'immersion (fiche et liste candidats).

### Changed

- MCP péda (#930) : `peda_kpi_overview.alternants` renommé `alternantsSnapshot` (instantané à ce jour, non filtré par année) ; un effectif nul n'est plus masqué ; `alternantsSnapshot` n'est plus masqué (déjà exposé par `list_alternants`) ; `list_sequences_overdue` / `list_sequences_upcoming` excluent les SA postérieures à la fin de contrat.
- Authentification Google par tenant (#883) : second client OAuth dédié à Annemasse (`GOOGLE_ANNEMASSE_*`) avec repli sur le client historique quand il n'est pas configuré.
- Renommage du TP « SA » en « CADGA » (#995) : « Chargé d'accueil et de gestion administrative » dans les enums GraphQL/TS, les dossiers Drive, les PDF et le front ; les fiches et configurations portant encore « SA » restent lues (`normalizeTpCode`, `expandTpFilter`).
- Entretiens AB (#1000) : les utilisateurs de rôle `GESTION` rejoignent les RH et les `is_interviewer` dans la liste des intervieweurs.

### Fixed

- Modale de changelog (#994) : rendue via un portail sur `document.body` pour un centrage et un alignement corrects.
- Création rapide de candidat (#998) : le ou les TP sont désormais obligatoires (plus de `CC` par défaut), ce qui évite le mauvais routage du dossier Drive.

### Security

- MCP péda (#930) : masquage complémentaire des agrégats (une cellule `<5` isolée n'est plus déductible par soustraction du total). La cellule masquée par complément est étiquetée `masqué` (jamais `<5` sur une valeur ≥ 5).
- Péda (#932) : noms, e-mails et destinataires des élèves retirés des logs (redaction pino, plus de `details` dans le log de fin de run) ; `peda_draft_history.recipient` anonymisé après 365 jours (la `dedup_key` est conservée).
- Péda (#932) : recherche alternants/sessions échappée (plus d'injection de regex / ReDoS Mongo), terme plafonné à 100 caractères.

## [1.4.0] - 2026-10-09

### Added

- Espace Peda alternance (#878, #882) : pages `ListeAlternants`/`FicheAlternant` (modale de création, modale entreprise, timeline de séquences), service `AlternantService` et schémas Mongo `alternant`/`alternant-sequence`.
- Dashboard de suivi SA (#876, #884) : `DashboardPeda` avec compteurs et listes de suivi.
- Sessions d'alternance (#877, #885) : modèle `Session` + pages `ListeSessions`/`FicheSession` (`SessionFormModal`), liaison alternant↔session.
- Ruptures (#879, #886) : modèle/service `Rupture`, page `Ruptures` et `RuptureModal` sur la fiche alternant.
- Archivage alternants/SA (#881, #887) : flags `archived`, onglet archive et règles d'archivage à la clôture rupture/session.
- Notifications SA en retard/à venir et rupture déclarée (#890, #893) : `SaNotificationService` + scheduler dédié, intégration à la cloche de notifications.
- Éditeur de templates mail enrichi (#747) : couleurs texte/surlignage (picker libre + presets), tailles en px, bouton CTA, images pleine largeur non déformées, barre de séparation personnalisable (couleur, épaisseur, largeur, alignement), thèmes prédéfinis, largeur mail 600 px, sanitisation HTML côté serveur (`sanitizeMailHtml`) et aperçu in-app aligné sur l'éditeur.
- Thème clair/sombre, toasts globaux et sidebar repliable/épinglable (#551) : `themeStore` + `ThemeToggle`, `toastStore` + `Toaster`, `sidebarStore` + `CollapsibleSidebar`/`SpaceSwitcher`/`AppFooter`.
- Fuseaux horaires par tenant (#801, #802) : `TENANT_TIMEZONE` central (back, via ALS) + `lib/timezone.ts` (front), `GET /:signature/profile.timezone`, Annemasse sur `Europe/Paris` au lieu d'`Indian/Reunion`.
- Compteurs et historique complet des relances (#855, #860) : schéma/repo/contrôleur back et refonte de `Relance.tsx`.
- Période d'essai candidat (#898, #906) : date de fin calculée (`trialPeriod.ts`), saisie dans `ContractModal`, modale d'alerte sur le dashboard RH.
- Champs immersion enrichis (#900, #910) : n° de convention, horaires et entreprise dans la modale immersion.
- Garde d'âge min-max sur les AB (#908, #911) : `NeedsAnalysisModal` bloque la sauvegarde hors tranche d'âge du candidat.
- Indicateur couleur entreprise sur le dashboard RH (#907, #912) : vert/orange/rouge/gris dans la modale entreprise (GraphQL `needsAnalysis`).
- Orientation des candidats en échec de test (#902, #913) : choix de redirection et mail d'orientation (`testFailureOrientation`, `MailTemplateService`).
- Nouveaux statuts d'entretien du calendrier (#896, #904) : propagés aux KPI (`RhKpiPanel`).
- Colonnes de la modale entreprise RH et filtre des entrées d'historique manuelles (#899, #909).
- CC sur le mail d'envoi aux entreprises (#826, #829) : `SendToCompanyModal`, MIME Gmail et resolver GraphQL `offers`.
- Groupes de communes dans les filtres candidats (#830, #831) : Nord/Est/Ouest/Sud + Hors Réunion.
- Communes (#765, #805) et secteurs (#832, #835) d'Annemasse : référentiels, matching, offres, AB et KPI.
- Nouveaux outils MCP (#875, #880) : `list_offer_history`, `list_users`, `list_company_conflicts`, exposition de `lastRelanceAt`/`signedAt` des AB.
- Script de suppression de liste SIRET en prod (`scripts/delete_companies.py`) et addendum `HOWTODEPLOY.md` (#777).
- Dependabot npm + actions GitHub (#769, #770).
- Bouton d'affichage du NIR (requête GraphQL `unmaskSSN`) et CGU Disciplina (#523, #537).

### Changed

- Refonte UI/UX du front (#551) : couleurs de marque (boutons primaires, nav active), chrome glass, `Tabs`/`SegmentedControl` coulissants, nouvelle librairie `Button`/`Card`/`Badge`/`Select`/`Tooltip`/`Spinner`/`EmptyState`/`PageHeader`/`Logo`, barre de recherche candidat, barre d'actions relance sticky, layouts refactorés (~150 fichiers).
- Visuel peda (#889, #891) : réorganisation des onglets, couleurs SA en retard/à venir, bouton rupture.
- Couleurs des entrées calendrier simplifiées et centralisées (#897, #905).
- Page de proposition externe en grille (#901, #914) et boutons « candidat suivant » plus visibles (#781, #783).
- Boutons de clôture des liens externes en remplacement du délai d'expiration (#854, #857).
- Message d'aide au survol pour le choix de région sur la page de connexion (#780, #784).
- Nettoyage des scripts : 19 scripts obsolètes supprimés (imports/migrations ponctuels), `delete_companies.py` conservé (#778, #785).
- Audit des dépendances front/back (#764, #768) et audit des écarts multi-tenant Annemasse (`AUDIT_MULTITENANT.md`, #799, #800).

### Fixed

- CSP de la route OAuth (flux consentement/popup) (#762, #763).
- Note de test notée sur 10 au lieu de 20 (#766, #771).
- Spam de mails à la signature d'AB : déduplication/throttle du webhook YouSign (#779, #782).
- Spam notif/mail/sauvegarde sur les AB brouillon : flag `needsAnalysis` + garde d'archivage Drive (#774, #776).
- Recherche SIRET : dispatch SIREN vs SIRET vers le contrôleur sourcing (#804, #806).
- MIME Nginx pour PDF.js (`.mjs`/wasm) en prod (#807, #808).
- Compatibilité Safari de PDF.js (`readableStreamAsyncIterator`) (#825, #827).
- PDF invalides : plus de crash de route (`PdfRenderBoundary` + fallback téléchargement), upload rejeté sans magic bytes `%PDF-` (400) (#841, #848).
- Appel « non » + relance comptés 2 KPI (#828, #833).
- Effacement du champ de recherche persisté (`usePersistedListView`) (#834, #836).
- Lieu de formation Annemasse (formulaire, fiche, questionnaire AB) (#852, #853).
- Mappers région/zone/secteur des offres côté back (#856, #858).
- Secteur de réunion Annemasse (migration MySQL + calendrier) (#839, #844).
- Lieux de poste Annemasse/Réunion séparés sur la modale AB (#837, #838).
- Mentions légales : placeholders remplacés par le contenu final (#778, #785).
- Filtre des types TP candidats (#499, #538).

### Security

- Masquage du NIR dans les outils MCP candidats et resserrement du scrub des clés sensibles (#875, #880).

## [1.3.0] - 2026-09-18

### Added

- Socle multi-tenant Annemasse (#709, #716) : second tenant avec bases MySQL/Mongo dédiées, routage backend par région du JWT (`db/tenant.ts`, `mongo/tenant.ts`), OAuth Google, webhooks ClassMarker/YouSign, SSE et schedulers régionalisés. Correctifs d'écarts (#717, #718), script de migration `migrate-multi-tenant.py`, jeu de données de test `seed_annemasse_test_data.py` et documentation de déploiement (#730, #731).
- Sélection de la région au login et badge de région permanent (#724) : choix du tenant (Réunion/Annemasse) dans le formulaire de connexion (mémorisé en `localStorage`), badge visible dans les cinq espaces, `/portail` redirige vers `/login`.
- Authentification OAuth du serveur MCP et RBAC par outil (#712, #723) : consentement par compte CRM (email/mot de passe/région), tokens délimités par région, chaque outil MCP scopé en miroir des guards GraphQL, `list_notifications` restreint à l'utilisateur courant.
- Liste des entreprises actives sur le dashboard RH (#739, #744) : champ `lastActiveAt` alimenté par les AB et les offres.
- Envoi des PDF au commercial à la signature d'une AB (#713, #746) : `SignedAbProcessor` et le contrôleur YouSign transmettent les documents signés par mail.
- Encadré « déjà envoyé » sur la fiche candidat (#748, #751) : `CandidateSentCompaniesCallout` liste les entreprises déjà destinataires du profil.
- Question optionnelle sur les plateformes de recherche d'emploi (#755, #756) : champ `job_search_platforms` sur la fiche candidat (formulaires, questionnaire AB, PDF).
- Seuils de validation des tests par TP (#738, #740) : moyenne minimale de 10 pour CC, 12 pour NTC/REM/AD/SA (`testGateThreshold`), création rapide de candidat (`CandidateQuickCreateModal`).
- Redirection Drive sur les AB signées depuis le matching (#700, #701).
- Statut « Non renseigné » pour le In-Contract candidat (#698, #699) : `ContractModal`/`JobSearchModal`.
- Champ de recherche dans le calendrier (#706, #707).
- Secteur d'activité multi-sélection pour les entreprises (#710, #719) : `CreateEditModal`, fiche entreprise et filtres du portefeuille.
- Notification à la bascule d'un candidat vers `in_contract` (#711, #720).
- Interface de gestion des accès externes (#692) : pilotage des liens `/external/*`.
- Scripts de déploiement/rollback (`scripts/deploy.sh`, `scripts/rollback.sh`) et guide `HOWTODEPLOY.md` (#730, #731, #734, #736).

### Changed

- Liens externes sans code d'accès (#715, #757) : suppression de la génération/exigence de code (`ExternalAccessService`, `MatchAccessService`), contrôleurs et garde simplifiés.
- Mentions légales : placeholders remplacés par le contenu final (#742, #743).
- Nommage « Catalogue » pour la sauvegarde Drive et l'envoi mail des PDF d'AB signées (#745, #749).
- Historique du matching : entrées automatiques et manuelles distinguées, avec filtre (#753, #754).

### Fixed

- Comptage KPI des entretiens candidat issus de l'import CV externe (#704, #705).
- Anomalie MCP sur les offres (#737, #741) : filtrage via `OfferRepository`/`OfferService`.

## [1.2.0] - 2026-09-14

### Added

- Garde de consentement RGPD (`services/consentGuard.ts`, #639) : vérification du consentement candidat avant génération de résumé IA (`AI_PROCESSING`), affichage/partage d'avatar (`PHOTO_PROCESSING`) et partage avec les entreprises (`DATA_SHARING` — Filiz, matching CV/liste). Mode `warn` transitoire avec log, filtrage silencieux pour la liste externe.
- Champs de planning sur les offres et l'analyse de besoin (#605) : horaires hebdomadaires persistés (Mongo `needsAnalysis`/`matching`), saisis dans `NeedsAnalysisModal`/`JobSearchModal`, injectés dans le mail d'offre au candidat et le PDF AB.
- Regroupement des tâches identiques (#628) : `TodoGroupRepository` + `TodoService` groupent les tâches partageant le même intitulé, `GroupSelector` côté front, migrations MySQL associées.
- Recherche candidat améliorée (#611) : index texte MongoDB v2 avec tokenisation et normalisation, refonte de `CandidateRepository` pour une recherche plus pertinente.
- Politique d'application compacte dans la sidebar (#524) : composant `LegalLinks` et constantes `legalLinks.ts` affichés dans `AdminLayout`, `CommercialLayout`, `EntrepriseLayout`, `PedaLayout` et `RHLayout`.
- Statuts de conclusion d'entretien (#627) : nouveaux statuts de résultat d'entretien sur les offres, `InterviewConclusionModal` mis à jour.
- Suppression d'entreprise avec modale de confirmation et notification (#664) : `DeleteCompanyModal`, `SirenGroupCard`/`EntrepriseCard` et `portefeuilleStore`.
- Suppression d'utilisateur en soft delete (#662) : colonnes `is_deleted`/`deleted_at` sur `users`, `UserDeletionService` et `DeleteUserModal` côté admin, conservation des références KPI/candidats/entreprises.
- Filtre global des entreprises (#626) : `FilterPanel`/`statusConfig` et `companyMapper` permettent de filtrer l'ensemble du portefeuille.
- Unification des KPI dans MongoDB (#513) : collection unique `kpis` (`kind: commercial|rh`), `KpiRepository`/`RhKpiRepository` Mongo, migration automatique au boot (`legacyKpiImport.ts`, `scripts/migrate-kpi-to-mongo.ts`), suppression des DDL MySQL associées.
- Tag « Véhicule » (`hasVehicle`) sur candidat et AB (#671) : champ conditionnel candidat/AB, affiché dans `CandidateFormModal`, `ABDetailModal`/`ABDetailContent` et le PDF.
- Toggle d'activation des relances par AB (#681) : champ `shouldRelance` (`needsAnalysis.schema`, `NeedsAnalysisService`, `ABDetailModal` + hooks/queries `useUpdateShouldRelance`).
- Bouton « Voir l'AB » sur les pages de matching (#725) : `AbHeader` et `JobDetailsSection` dans `Matching.tsx` (`/rh/matching?needsAnalysis=…`), `NeedsAnalysisCard` (liste `/rh/matching`) et `MatchedJobsList` (fiche candidat) ouvrent `ABDetailModal` pour consulter l'analyse de besoin sans quitter le contexte matching.

### Changed

- Contenu du mail d'offre au candidat ajusté (#603) : ajustements mineurs dans `Matching.tsx`.
- Mails externes : en-tête `Reply-To: noreply@disciplina.re` ajouté à tous les envois Gmail (`mime.builder.ts`, `no-reply.ts`, #601) ; `From` Gmail conservé.
- KPI : bascule MySQL → MongoDB avec bump atomique via pipeline `$replaceWith` + clamp `$max`, noms résolus via `UserRepository.findByIds` (#513).
- Rework complet des accès externes (#514) : flux unifiés profil matché / réservation d'entretien / import CV sous `/external/*`. Les anciens liens `/public/*` déjà envoyés par email redirigent automatiquement vers le nouveau flux. Le code d'accès est désormais envoyé par email au chargement de la page (et plus dans l'email d'invitation), le lien de réservation d'entretien s'affiche sous forme de bouton « Choisir mon créneau ». Tables `interview_access`, `match_link` et `external_link` consolidées dans `external_access`.
- `ABDetailModal` : rendu via `createPortal` sur `document.body` et dimensions élargies (`max-w-3xl`, `max-h-[88vh]`, `items-center justify-center`) pour garantir un affichage centré et lisible même depuis la vue matching détaillée.

### Fixed

- Vérifications des créneaux indisponibles du calendrier (#598) : `InterviewAccessService` et `flow.test.ts`.
- Planning AB : tests et corrections du schedule (#644).
- Case à cocher de consentement RGPD (#654) : `candidate.mapper.ts`.
- Erreurs pré-existantes de lint/tests/e2e (#656).
- Filtrage par secteur dans le matching (#670) : correction `CandidateService`/`OfferService` + utilitaire `zone.ts`.
- Offres inactives exclues de la recherche d'offres côté candidat (#672) : `OfferRepository`/`CandidateService`.
- Affichage du recruteur même si e-mail/téléphone identique au représentant (#678) : `OfferService`/`needsAnalysis.mapper` et `CompanyInfoModal`/`Matching.tsx`.
- Fuseau horaire des entretiens sur la page de matching (#676) : `InterviewProposalForm`, `InterviewSlotPicker`, `Matching.tsx`.
- Placement des boutons (chevauchement) (#681).
- Hooks pré-commit contournables corrigés (#658) : `skip hooks` ne bypass plus les vérifications.
- Filtres de statut des accès externes (#514) : `ExternalAccessRepository.findAllFiltered` utilisait `IN (?)` avec un tableau, non développé par `pool.execute()` (prepared statements) — le statut arrivait comme un littéral unique et chaque onglet renvoyait un résultat vide. Placeholders énumérés `IN (?, ?, …)` pour les filtres `statuses` et `types`.
- Modal de détail d'AB tronquée/mal centrée depuis une page de matching sélectionnée (#725) : `ABDetailModal` tronquée par le layout `backdrop-blur`/`overflow` du matching (affichage à moitié hors écran en haut) ; corrigé par portail pleine-page, centrage `items-center justify-center` et hauteur `max-h-[88vh]` avec scroll interne.

## [1.1.0] - 2026-08-20

### Added

- Consentement RGPD à la création d'une fiche candidat : 4 cases à cocher
  distinctes (traitement des données — obligatoire, partage avec les
  entreprises partenaires, traitement par IA locale pour le résumé de profil,
  stockage de la photo/avatar). Objectif : établir une base légale explicite
  pour la collecte des données du candidat, dès la création de sa fiche et non
  plus seulement via la signature en fin de document.
- Script de rétro-consentement (`back/scripts/migrate-candidate-consentments.ts`)
  pour les fiches candidat créées avant l'introduction de ce champ.
- Notification lors de la signature d'une AB (alternance bout en main).
- Logique de secteur appliquée au back-end (KPI, calendrier).
- Champ et filtre « genre » pour les candidats.
- Indicateur « a un CV » et option « ne pas envoyer » dans la modale de
  proposition.
- Sauvegarde automatique des bases de données.
- Les AB signées sont rangées dans des sous-dossiers pour faciliter le tri.
- Les tâches peuvent être assignées à d'autres utilisateurs (avec notification
  lors de l'assignation).
- Boutons « venu / pas venu » pour les événements créés hors de l'application
  (KPI).
- Nouveaux champs de recherche de candidats (téléphone, e-mail).
- Filtre de statut « sans emploi » appliqué au matching.
- À l'assignation d'un contrat, toute entreprise peut être recherchée, sans
  restriction de TP.
- Recherche d'entreprise insensible à la casse.

### Changed

- Le statut des AB (`AB_STATUS`) est désormais un champ persistant, modifiable
  manuellement.
- Les AB signées donnent la priorité aux comptes « rechargeables », avec repli
  sur un autre commercial connecté.
- Refonte du remplacement des variables dans les templates de mail (plus de
  templates utilisent des variables).
- Expiration des liens de matching portée de 24 h à 72 h.
- Amélioration du prompt de génération de description IA.

### Fixed

- Sanitisation des filtres persistés (`persistedListView`).
- Les AB sont enregistrées dans le drive de leur secteur, au lieu de celui du
  commercial.
- Exclusion des secteurs d'activité personnalisés sur les AB ; le matching
  recherche désormais aussi hors de ces secteurs.
- Correction de la logique de calcul du chiffre d'affaires (MySQL).
- Migration et chiffrement du SSN (NIR) en production.
- Nettoyage du tag immersion après un changement de statut.
- Correction de la logique de quarantaine.

### Security

- Correctif CSRF Apollo.
- Validation renforcée du webhook Docuseal (schéma/HMAC invalide).

## [1.0.0] - 2026-08-05

### Added

- Espace légal public : pages CGU (interne, candidat, entreprise), mentions
  légales, politique de confidentialité, politique cookies et bannière de
  consentement.
- Automatisation de la signature des relances (PDF signé ajouté aux modèles de
  relance).
- Filtre TP réglable sur les modales d'ajout de candidats.
- Chiffrement du NIR (numéro de sécurité sociale) des candidats au repos.
- Badge « Responsable » visible dans la navigation des espaces.

### Changed

- Le changement de statut de contrat d'un candidat est désormais synchronisé
  depuis la liste des candidats vers les offres.
- Refonte des mails de relance.

### Fixed

- Accès « Responsable » cassé rétabli sur certains espaces.
- Correctifs de sécurité (champ NIR, surfaces d'exposition).