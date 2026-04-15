CREATE DATABASE IF NOT EXISTS sales_service;
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
    SIRET CHAR(14) UNIQUE NOT NULL,
    IDCC CHAR(4) DEFAULT NULL,
    APE CHAR(5) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    conclusion VARCHAR(255) NOT NULL,
    FOREIGN KEY (sale_person_id) REFERENCES sale_persons(id) ON UPDATE CASCADE
);
