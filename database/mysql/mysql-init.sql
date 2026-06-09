CREATE DATABASE IF NOT EXISTS disciplina;
USE disciplina;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'COMMERCIAL', 'RH') NOT NULL,
    sectors JSON DEFAULT NULL,
    oauth_token TEXT DEFAULT NULL,
    refresh_token TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS filiz (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

INSERT INTO users (id, email, name, password, role)
VALUES
    (1, 'root@example.com', 'root', '$2a$10$NsZzHNIPBrHpuvEePoheu.DRTImS6mEAWC4A1NYiNxiNi6kZhki8e', 'ADMIN'),
    (2, 'sans-commerciaux@disciplina.com', 'sans-commerciaux', '$2a$10$imIY6KBorYrcZ4Tr7VxBwOeSqj0IufPykYAJ5Qke3VS8wAiGF/hJu', 'ADMIN'),
    (3, 'sinaman.commercial@disciplina.re', 'Amanda', '$2a$10$aUfW35HzC24awAbUjXuTzusv5SYcP7J0QhnvOeD.qK//qbsugpppe', 'COMMERCIAL'),
    (4, 'galmar.commercial@disciplina.re', 'Brandon', '$2a$10$2RM20a22qDJ.8icsoiDoAOHvDhAIbgsyV/sWWJPPS0lgi32/T/BeK', 'COMMERCIAL'),
    (5, 'lebon.commercial@disciplina.re', 'Emile', '$2a$10$mMVS8gxP9bT.HpX.FStLvupuSu5ZErfZIfJI4svAT6dJvlIc9oIQe', 'COMMERCIAL');

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    legal_referent VARCHAR(255) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    address VARCHAR(255) NOT NULL,
    sector VARCHAR(255) NOT NULL,
    main_activity VARCHAR(255) DEFAULT NULL,
    siret CHAR(14) UNIQUE NOT NULL,
    idcc CHAR(4) DEFAULT NULL,
    ape CHAR(5) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    conclusion VARCHAR(255) NOT NULL,
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

    -- Etape 3: Le Poste & Les Missions
    positions_count INT NOT NULL DEFAULT 1,
    localisation ENUM('NORD', 'OUEST', 'SUD') NOT NULL,
    training_domain ENUM('SECRETARIAT', 'VENTE') NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    selected_missions JSON NOT NULL,
    other_missions TEXT DEFAULT NULL,
    job_description_missions JSON DEFAULT NULL,
    job_description_other TEXT DEFAULT NULL,

    -- Etape 4: Exigences de l'Apprenti
    education_level ENUM('BAC', 'BAC_PLUS_2', 'BAC_PLUS_3') NOT NULL,
    driving_license ENUM('OUI', 'OPTIONNEL') NOT NULL,
    experience_required ENUM('DEBUTANT', 'OBLIGATOIRE') NOT NULL,
    age_requirements JSON NOT NULL,
    soft_skills TEXT DEFAULT NULL,
    schedule_options JSON DEFAULT NULL,
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
