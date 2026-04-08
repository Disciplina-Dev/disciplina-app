-- ============================================================
-- Disciplina — schéma complet (Phase 1 : CRM Commercial)
-- NOTE : les ENUM utilisent des valeurs ASCII (sans accents)
--        pour éviter les problèmes d'encodage MySQL.
--        Le mapping vers les labels français se fait côté application.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `disciplina-ab`;
USE `disciplina-ab`;

-- ── Utilisateurs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateur (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  telephone     VARCHAR(25)  DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','manager','commercial','rh','pedagogique') NOT NULL,
  centre        ENUM('nord','ouest','sud') NOT NULL,
  actif         TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

-- ── Entreprises ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entreprise (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  raison_sociale       VARCHAR(255) NOT NULL,
  siret                VARCHAR(14)  UNIQUE,
  adresse              VARCHAR(255) DEFAULT NULL,
  code_postal          CHAR(5)      DEFAULT NULL,
  commune              VARCHAR(100) DEFAULT NULL,
  description_activite TEXT         DEFAULT NULL,
  -- Contact
  telephone            VARCHAR(25)  DEFAULT NULL,
  email                VARCHAR(255) DEFAULT NULL,
  site                 VARCHAR(255) DEFAULT NULL,
  -- CRM (valeurs ASCII-safe pour les ENUM)
  statut       ENUM('prospect','contacte','ok','indecis','non','partenaire') NOT NULL DEFAULT 'prospect',
  source       ENUM('pages_jaunes','linkedin','indeed','facebook',
                    'listing_lorenzo','france_travail','recommandation','autre') DEFAULT NULL,
  commercial_id INT DEFAULT NULL,
  secteur       VARCHAR(100) DEFAULT NULL,
  -- Timestamps
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_entreprise_commercial
    FOREIGN KEY (commercial_id) REFERENCES utilisateur(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4;

-- ── Contacts entreprise ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_entreprise (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  entreprise_id INT NOT NULL,
  nom_prenom    VARCHAR(255) NOT NULL,
  fonction      VARCHAR(255) DEFAULT NULL,
  telephone     VARCHAR(25)  DEFAULT NULL,
  email         VARCHAR(255) DEFAULT NULL,
  type          ENUM('representant_legal','responsable_recrutement') NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_entreprise
    FOREIGN KEY (entreprise_id) REFERENCES entreprise(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- ── Historique des appels ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  entreprise_id INT NOT NULL,
  result        ENUM('ok','indecis','non') NOT NULL,
  notes         TEXT         DEFAULT NULL,
  commercial_id INT          DEFAULT NULL,
  called_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_call_e FOREIGN KEY (entreprise_id) REFERENCES entreprise(id)  ON DELETE CASCADE,
  CONSTRAINT fk_call_u FOREIGN KEY (commercial_id) REFERENCES utilisateur(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4;

-- ── Relances ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS relances (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entreprise_id  INT  NOT NULL,
  scheduled_date DATE NOT NULL,
  notes          TEXT DEFAULT NULL,
  statut         ENUM('planifiee','faite','annulee') NOT NULL DEFAULT 'planifiee',
  commercial_id  INT  DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rel_e FOREIGN KEY (entreprise_id) REFERENCES entreprise(id)  ON DELETE CASCADE,
  CONSTRAINT fk_rel_u FOREIGN KEY (commercial_id) REFERENCES utilisateur(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4;

-- ── Analyse de Besoin ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyse_besoin (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  entreprise_id           INT NOT NULL,
  commercial_id           INT NOT NULL,
  centre                  ENUM('nord','ouest','sud') NOT NULL,
  statut                  ENUM('brouillon','envoye','signe','transmis_rh','cloture') NOT NULL DEFAULT 'brouillon',
  domaine                 ENUM('secretariat','vente') NOT NULL,
  niveau                  ENUM('bac','bac2','bac3') NOT NULL,
  intitule_metier         VARCHAR(255) DEFAULT NULL,
  localisation_poste      VARCHAR(255) DEFAULT NULL,
  nb_postes               INT DEFAULT 1,
  description_missions    TEXT DEFAULT NULL,
  profil_recherche        TEXT DEFAULT NULL,
  competences             TEXT DEFAULT NULL,
  commentaires            TEXT DEFAULT NULL,
  missions_cochees        JSON DEFAULT NULL,
  age_exige               ENUM('18_20','21_25','26_29','sans_preference') DEFAULT NULL,
  permis                  ENUM('obligatoire','optionnel','non_requis') DEFAULT NULL,
  experience              ENUM('debutant','obligatoire') DEFAULT NULL,
  methode_recrutement     ENUM('tous_cv','preselection','pre_entretien') DEFAULT NULL,
  pmsmp                   ENUM('oui','non','a_discuter') DEFAULT NULL,
  jours_formation         JSON DEFAULT NULL,
  engagement_evolution    TINYINT(1) DEFAULT 0,
  engagement_adaptation   TINYINT(1) DEFAULT 0,
  engagement_reajustement TINYINT(1) DEFAULT 0,
  clause_confidentialite  TINYINT(1) DEFAULT 0,
  lieu_signature          VARCHAR(255) DEFAULT NULL,
  date_signature          DATE DEFAULT NULL,
  yousign_request_id      VARCHAR(255) DEFAULT NULL,
  yousign_document_url    TEXT DEFAULT NULL,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at                 TIMESTAMP DEFAULT NULL,
  signed_at               TIMESTAMP DEFAULT NULL,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ab_entreprise  FOREIGN KEY (entreprise_id) REFERENCES entreprise(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_ab_commercial  FOREIGN KEY (commercial_id) REFERENCES utilisateur(id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4;

-- ── AB en attente (webhook YouSign) ───────────────────────────
CREATE TABLE IF NOT EXISTS ab_pending (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  yousign_request_id VARCHAR(255) NOT NULL UNIQUE,
  payload            JSON NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

-- ── Données de test ───────────────────────────────────────────
INSERT IGNORE INTO utilisateur (nom, prenom, email, password_hash, role, centre) VALUES
  ('Disciplina', 'Systeme', 'systeme@disciplina.re', 'n/a', 'admin', 'nord'),
  ('M.',  'Amanda', 'amanda.m@disciplina.re',  'n/a', 'commercial', 'nord'),
  ('R.',  'Emile',  'emile.r@disciplina.re',   'n/a', 'commercial', 'nord'),
  ('F.',  'Grande', 'grande.f@disciplina.re',  'n/a', 'commercial', 'ouest'),
  ('D.',  'Martin', 'martin.d@disciplina.re',  'n/a', 'commercial', 'ouest'),
  ('V.',  'Lucas',  'lucas.v@disciplina.re',   'n/a', 'commercial', 'nord'),
  ('C.',  'Marion', 'marion.c@disciplina.re',  'n/a', 'commercial', 'ouest');

INSERT IGNORE INTO entreprise (raison_sociale, siret, adresse, code_postal, commune, statut, source, secteur, telephone, commercial_id)
SELECT r.raison_sociale, r.siret, r.adresse, r.cp, r.commune, r.statut, r.source, r.secteur, r.tel, u.id
FROM (
  SELECT 'Garage Riviere'          AS raison_sociale, '83284921000018' AS siret, '12 Rue des Flamboyants' AS adresse, '97400' AS cp, 'Saint-Denis'     AS commune, 'indecis'    AS statut, 'pages_jaunes'   AS source, 'Automobile'   AS secteur, '+262 692 12 34 56' AS tel, 'amanda.m@disciplina.re'  AS email UNION ALL
  SELECT 'Maison Kariba',            '79283716000042', '8 Allee des Vacoas',      '97430', 'Le Tampon',       'ok',         'linkedin',       'Hotellerie',   '+262 692 45 67 89', 'emile.r@disciplina.re'  UNION ALL
  SELECT 'SFR Reunion',              '34223971000074', '15 Rue Jean Chatel',      '97400', 'Saint-Denis',     'partenaire', NULL,             'Telecom',      '+262 692 11 00 00', 'grande.f@disciplina.re' UNION ALL
  SELECT 'Optic 2000 Saint-Denis',   '52819483000031', '24 Rue du Marche',        '97400', 'Saint-Denis',     'prospect',   'pages_jaunes',   'Optique',      NULL,                'amanda.m@disciplina.re' UNION ALL
  SELECT 'Leclerc Saint-Paul',       '61732984000025', '1 Rue de la Savane',      '97460', 'Saint-Paul',      'contacte',   'france_travail', 'Distribution', '+262 692 78 90 12', 'martin.d@disciplina.re' UNION ALL
  SELECT 'Cabinet Medical Nord',     '71920384000019', '5 Av. de la Victoire',    '97400', 'Saint-Denis',     'non',        'linkedin',       'Sante',        '+262 692 22 33 44', 'lucas.v@disciplina.re'  UNION ALL
  SELECT 'RunWeb Solutions',         '90128374000062', '3 Rue des Developpeurs',  '97490', 'Sainte-Clotilde', 'ok',         'recommandation', 'Informatique', '+262 692 55 66 77', 'amanda.m@disciplina.re' UNION ALL
  SELECT 'Boulangerie Soleil',       '55674829000047', '2 Rue du Four',           '97460', 'Saint-Paul',      'contacte',   'facebook',       'Alimentaire',  '+262 692 88 99 11', 'marion.c@disciplina.re'
) r
JOIN utilisateur u ON u.email = r.email;
