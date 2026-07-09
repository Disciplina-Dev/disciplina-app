SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS disciplina;
USE disciplina;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'RESPONSABLE', 'COMMERCIAL', 'RH', 'PEDA') NOT NULL,
    sectors JSON DEFAULT NULL,
    oauth_token TEXT DEFAULT NULL,
    refresh_token TEXT DEFAULT NULL,
    -- Habilité à mener les entretiens AB (liste « Entretien fait par »).
    is_interviewer TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS filiz (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

INSERT INTO users (id, email, first_name, last_name, password, role)
VALUES
    (1, 'root@example.com', 'root', 'root', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'ADMIN'),
    (2, 'sans-commerciaux@disciplina.com', 'sans', 'commerciaux', '$2a$10$imIY6KBorYrcZ4Tr7VxBwOeSqj0IufPykYAJ5Qke3VS8wAiGF/hJu', 'ADMIN'),
    (3, 'sinaman.commercial@disciplina.re', 'Amanda', 'Sinaman', '$2a$10$aUfW35HzC24awAbUjXuTzusv5SYcP7J0QhnvOeD.qK//qbsugpppe', 'RESPONSABLE'),
    (4, 'galmar.commercial@disciplina.re', 'Brandon', 'Galmar', '$2a$10$2RM20a22qDJ.8icsoiDoAOHvDhAIbgsyV/sWWJPPS0lgi32/T/BeK', 'COMMERCIAL'),
    (5, 'lebon.commercial@disciplina.re', 'Emile', 'Lebon', '$2a$10$mMVS8gxP9bT.HpX.FStLvupuSu5ZErfZIfJI4svAT6dJvlIc9oIQe', 'COMMERCIAL'),
    (6, 'loic.rh@disciplina.re', 'Loic', 'grondin', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'RH'),
    -- Commerciaux présents dans kpi_commercial.xlsx (en-têtes par prénom).
    -- Le rattachement KPI se fait sur le prénom : last_name à compléter, mdp à changer.
    (7, 'elsa.commercial@disciplina.re', 'Elsa', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (8, 'laureen-lee.commercial@disciplina.re', 'Laureen-Lee', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (9, 'brice.commercial@disciplina.re', 'Brice', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (10, 'lamia.commercial@disciplina.re', 'Lamia', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (11, 'lucas.commercial@disciplina.re', 'Lucas', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (12, 'martin.commercial@disciplina.re', 'Martin', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL'),
    (13, 'marion.commercial@disciplina.re', 'Marion', 'a-renseigner', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'COMMERCIAL');

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    legal_referent VARCHAR(255) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    address VARCHAR(255) NOT NULL,
    sector VARCHAR(255) NOT NULL DEFAULT 'Nord-Est',
    main_activity VARCHAR(255) DEFAULT NULL,
    siret CHAR(14) UNIQUE NOT NULL,
    idcc CHAR(4) DEFAULT NULL,
    ape CHAR(5) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    conclusion VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'À Réfléchir',
    relance_date DATE DEFAULT NULL,
    relance_type TINYINT DEFAULT NULL,
    relance_template_id VARCHAR(64) DEFAULT NULL,
    relance_channel ENUM('PHONE', 'MAIL') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS relance_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    type_relance INT DEFAULT NULL,
    channel ENUM('PHONE', 'MAIL') NOT NULL,
    subject TEXT DEFAULT NULL,   -- objet du mail (canal MAIL)
    note TEXT DEFAULT NULL,      -- résumé de l'appel (canal PHONE)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_relance_history_company (company_id)
);

CREATE TABLE IF NOT EXISTS company_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_column TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50) DEFAULT NULL,
    modified_by INT DEFAULT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_contact_company (company_id),
    INDEX idx_contact_user (user_id)
);

CREATE TABLE IF NOT EXISTS commercial_kpi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,                          -- NULL = données importées d'anciens users
    user_name VARCHAR(255) NOT NULL,      -- Préservé même si user supprimé
    year YEAR NOT NULL,
    month TINYINT NOT NULL,               -- 1-12
    week TINYINT NOT NULL DEFAULT 0,      -- 0 = ligne mensuelle, 1-53 = semaine
    site ENUM('NORD', 'OUEST', 'SUD') NOT NULL DEFAULT 'NORD',

    -- Statuts de réponse entreprise
    count_oui INT NOT NULL DEFAULT 0,
    count_oui_of INT NOT NULL DEFAULT 0,
    count_non INT NOT NULL DEFAULT 0,
    count_ne_repond_pas INT NOT NULL DEFAULT 0,
    count_a_reflechir INT NOT NULL DEFAULT 0,
    count_relance INT NOT NULL DEFAULT 0,

    -- Métriques volume
    total_appels INT NOT NULL DEFAULT 0,
    total_trie INT NOT NULL DEFAULT 0,
    nbre_ent_ferme INT NOT NULL DEFAULT 0,
    nbre_ent_ouvert INT NOT NULL DEFAULT 0,

    -- Visites terrain
    visites_terrain INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Identité d'une ligne KPI = un user réel (le nom n'est qu'un snapshot d'affichage)
    UNIQUE KEY unique_kpi (user_id, year, month, week, site),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS companies_blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    ab_id VARCHAR(36) DEFAULT NULL,
    legal_referent VARCHAR(255) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    address VARCHAR(255) NOT NULL,
    sector VARCHAR(255) NOT NULL DEFAULT 'Nord-Est',
    main_activity VARCHAR(255) DEFAULT NULL,
    siret CHAR(14) UNIQUE NOT NULL,
    idcc CHAR(4) DEFAULT NULL,
    ape CHAR(5) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    conclusion VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'À Réfléchir',
    relance_date DATE DEFAULT NULL,
    relance_type TINYINT DEFAULT NULL,
    relance_template_id VARCHAR(64) DEFAULT NULL,
    relance_channel ENUM('PHONE', 'MAIL') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    all_blacklist TINYINT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS needs_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,

    -- Etape 1: Representant legal & Responsable Recrutement
    legal_rep_function VARCHAR(255) DEFAULT NULL,
    recruitment_responsible_name VARCHAR(255) DEFAULT NULL,
    recruitment_responsible_phone VARCHAR(50) DEFAULT NULL,
    recruitment_responsible_email VARCHAR(255) DEFAULT NULL,
    recruitment_responsible_function VARCHAR(255) DEFAULT NULL,

    -- Etape 2: Entreprise
    company_sectors JSON DEFAULT NULL,
    company_description TEXT DEFAULT NULL,
    opco ENUM(
        'AKTO', 'ATLAS', 'AFDAS', 'CONSTRUCTYS', 'OCAPIAT', 'OPCO_2I',
        'OPCO_EP', 'OPCO_MOBILITES', 'OPCO_SANTE', 'OPCOMMERCE', 'UNIFORMATION'
    ) DEFAULT NULL,
    referral_source ENUM(
        'KOANN', 'E2CR', 'FRANCE_TRAVAIL', 'TELEVISION_PUB', 'BOUCHE_A_OREILLE',
        'MISSION_LOCALE', 'SALON', 'RSMA', 'RESEAUX_SOCIAUX'
    ) DEFAULT NULL,

    -- Etape 3: Le Poste & Les Missions
    positions_count INT NOT NULL DEFAULT 1,
    positions JSON DEFAULT NULL,
    localisation ENUM('NORD', 'OUEST', 'SUD') NOT NULL,
    training_domain ENUM('SECRETARIAT', 'VENTE') NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    selected_missions JSON NOT NULL,
    other_missions TEXT DEFAULT NULL,
    job_description_missions JSON DEFAULT NULL,
    job_description_other TEXT DEFAULT NULL,

    -- Etape 4: Exigences de l'Apprenti
    education_level ENUM('BAC', 'BAC_PLUS_2', 'BAC_PLUS_3') DEFAULT NULL,
    driving_license ENUM('OUI', 'OPTIONNEL') NOT NULL,
    experience_required ENUM('DEBUTANT', 'OBLIGATOIRE') NOT NULL,
    age_requirements JSON NOT NULL,
    age_min INT DEFAULT NULL,
    age_max INT DEFAULT NULL,
    soft_skills TEXT DEFAULT NULL,
    schedule_options JSON DEFAULT NULL,
    conditions TEXT DEFAULT NULL,
    additional_comments TEXT DEFAULT NULL,

    -- Etape 4: Logique & Process RH
    recruitment_method ENUM('ALL_CV', 'PRESELECTION', 'PRE_INTERVIEW') NOT NULL,
    immersion_period ENUM('OUI', 'NON', 'A_DISCUTER') NOT NULL,
    training_days JSON NOT NULL,

    -- Etape 5: Yousign & Statut
    yousign_signature_request_id VARCHAR(255) DEFAULT NULL,
    status ENUM('BROUILLON', 'EN_ATTENTE_SIGNATURE', 'SIGNE', 'EXPIRE') NOT NULL DEFAULT 'BROUILLON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS rh_kpi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sector VARCHAR(64) NOT NULL DEFAULT '',
    year SMALLINT NOT NULL,
    month TINYINT NOT NULL,
    week TINYINT NOT NULL,
    interviews_placed INT NOT NULL DEFAULT 0,
    interviews_attended INT NOT NULL DEFAULT 0,
    interviews_noshow INT NOT NULL DEFAULT 0,
    immersions INT NOT NULL DEFAULT 0,
    contracts INT NOT NULL DEFAULT 0,
    ruptures INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rh_kpi (user_id, sector, year, month, week),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS booking_settings (
    user_id INT PRIMARY KEY,
    slug VARCHAR(32) NOT NULL UNIQUE,
    enabled TINYINT NOT NULL DEFAULT 1,
    duration_min INT NOT NULL DEFAULT 30,
    buffer_min INT NOT NULL DEFAULT 0,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Indian/Reunion',
    min_notice_hours INT NOT NULL DEFAULT 12,
    max_days_ahead INT NOT NULL DEFAULT 30,
    working_hours JSON DEFAULT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Rendez-vous',
    location VARCHAR(255) DEFAULT NULL,
    confirmation_subject VARCHAR(255) DEFAULT NULL,
    confirmation_body TEXT DEFAULT NULL,
    proposition_subject VARCHAR(255) DEFAULT NULL,
    proposition_body TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Session de portail entreprise (acceptation interactive des candidats).
-- Une ligne = un lien envoyé à une entreprise pour répondre aux candidats proposés d'un job.
CREATE TABLE IF NOT EXISTS match_link (
    signature CHAR(64) PRIMARY KEY,
    code CHAR(6) NOT NULL,
    identifier VARCHAR(32) NOT NULL,
    rh_email VARCHAR(255) NOT NULL,
    company_email VARCHAR(255) NOT NULL,
    job_uuid VARCHAR(64) NOT NULL,
    status ENUM('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
    attempts TINYINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Choix de créneau d'entretien par le candidat (portail public, code d'accès simple).
-- Une ligne = un lien envoyé à un candidat proposé pour choisir un créneau parmi le pool du job.
CREATE TABLE IF NOT EXISTS interview_access (
    signature CHAR(64) PRIMARY KEY,
    code CHAR(6) NOT NULL,
    job_uuid VARCHAR(64) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    rh_email VARCHAR(255) NOT NULL,
    status ENUM('PENDING','AUTHENTICATED','COMPLETED','LOCKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
    attempts TINYINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_interview_access_job (job_uuid),
    INDEX idx_interview_access_candidate (candidate_id)
);

-- Lieu de rendez-vous par défaut, configurable par l'admin, pour chaque secteur
-- géographique (Nord-Est / Ouest / Sud). Pré-rempli dans la prise de RDV selon le
-- secteur du RH/responsable hôte (reste éditable).
CREATE TABLE IF NOT EXISTS sector_settings (
    sector VARCHAR(64) NOT NULL PRIMARY KEY,
    location VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Lieux par défaut (modifiables ensuite par l'admin via l'interface).
INSERT IGNORE INTO sector_settings (sector, location) VALUES
    ('Nord-Est', 'Disciplina Nord-Est — Sainte-Marie'),
    ('Ouest', 'Disciplina Ouest — Saint-Paul'),
    ('Sud', 'Disciplina Sud — Saint-Pierre');
