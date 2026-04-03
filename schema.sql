-- Création du schéma
CREATE DATABASE IF NOT EXISTS listing;
USE listing;

-- Table sector
CREATE TABLE IF NOT EXISTS sector (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    code_postal  CHAR(5) UNIQUE,
    name         VARCHAR(255) NOT NULL
);

-- Table companies
CREATE TABLE IF NOT EXISTS companies (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    sector_id     INT,
    name          VARCHAR(255) UNIQUE,
    siret         VARCHAR(14) UNIQUE,
    address       VARCHAR(255),
    main_activity TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sector
        FOREIGN KEY (sector_id)
        REFERENCES sector(id)
        ON DELETE SET NULL
);

-- Table referents
CREATE TABLE IF NOT EXISTS referents (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT,
    first_name  VARCHAR(255),
    last_name   VARCHAR(255),
    post        VARCHAR(255),
    phone       VARCHAR(25),
    email       VARCHAR(255),
    type        ENUM('LEGAL_REP', 'RECRUITMENT_MANAGER') NOT NULL,
    CONSTRAINT fk_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE SET NULL
);