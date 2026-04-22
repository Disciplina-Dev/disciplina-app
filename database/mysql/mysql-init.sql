CREATE DATABASE IF NOT EXISTS sales_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sales_service;

CREATE TABLE IF NOT EXISTS sale_persons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

INSERT INTO sale_persons (id, email, name)
VALUES
    (1, '', 'pas de commerciaux'),
    (2, 'sinaman.commercial@disciplina.re', 'Amanda'),
    (3, 'galmar.commercial@disciplina.re', 'Brandon'),
    (4, 'lebon.commercial@disciplina.re', 'Emile');

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_person_id INT,
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
    FOREIGN KEY (sale_person_id) REFERENCES sale_persons(id) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS analyse_besoin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token CHAR(36) NOT NULL UNIQUE,
    entreprise_id INT NOT NULL,
    sale_person_id INT DEFAULT NULL,
    campus ENUM('Nord', 'Ouest', 'Sud') NOT NULL,
    statut ENUM('brouillon', 'envoyee', 'validee', 'signee', 'archivee') NOT NULL DEFAULT 'brouillon',
    -- Étape 1 : Identité
    raison_sociale VARCHAR(255) DEFAULT NULL,
    siret CHAR(14) DEFAULT NULL,
    adresse_siege VARCHAR(255) DEFAULT NULL,
    code_postal VARCHAR(5) DEFAULT NULL,
    commune VARCHAR(255) DEFAULT NULL,
    rl_nom VARCHAR(255) DEFAULT NULL,
    rl_fonction VARCHAR(255) DEFAULT NULL,
    rl_telephone VARCHAR(50) DEFAULT NULL,
    rl_email VARCHAR(255) DEFAULT NULL,
    rr_same_as_rl TINYINT(1) NOT NULL DEFAULT 0,
    rr_nom VARCHAR(255) DEFAULT NULL,
    rr_fonction VARCHAR(255) DEFAULT NULL,
    rr_telephone VARCHAR(50) DEFAULT NULL,
    rr_email VARCHAR(255) DEFAULT NULL,
    -- Étape 2 : Poste
    presentation_activite TEXT DEFAULT NULL,
    nb_postes INT DEFAULT NULL,
    localisation_poste VARCHAR(255) DEFAULT NULL,
    domaine ENUM('Secretariat', 'Vente') DEFAULT NULL,
    intitule_poste VARCHAR(255) DEFAULT NULL,
    missions JSON DEFAULT NULL,
    autres_missions TEXT DEFAULT NULL,
    profils_recherches TEXT DEFAULT NULL,
    competences TEXT DEFAULT NULL,
    commentaires TEXT DEFAULT NULL,
    -- Étape 3 : Apprenti
    niveau_formation VARCHAR(50) DEFAULT NULL,
    permis VARCHAR(50) DEFAULT NULL,
    experience VARCHAR(50) DEFAULT NULL,
    age_exige VARCHAR(50) DEFAULT NULL,
    methode_recrutement VARCHAR(255) DEFAULT NULL,
    pmsmp VARCHAR(50) DEFAULT NULL,
    jours_formation JSON DEFAULT NULL,
    -- Étape 4 : Finalisation
    fait_a VARCHAR(255) DEFAULT NULL,
    fait_le DATE DEFAULT NULL,
    -- Métadonnées
    is_signed TINYINT(1) NOT NULL DEFAULT 0,
    yousign_procedure_id VARCHAR(255) DEFAULT NULL,
    pdf_url VARCHAR(500) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_person_id) REFERENCES sale_persons(id) ON DELETE SET NULL
);
