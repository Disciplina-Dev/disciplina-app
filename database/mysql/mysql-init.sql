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
