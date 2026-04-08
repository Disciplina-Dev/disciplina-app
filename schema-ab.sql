CREATE DATABASE IF NOT EXISTS disciplina-ab;
USE disciplina-ab;


CREATE TABLE IF NOT EXISTS entreprise (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    raison_sociale       VARCHAR(255) NOT NULL,
    siret                VARCHAR(14)  UNIQUE,
    adresse              VARCHAR(255),
    code_postal          CHAR(5),
    commune              VARCHAR(100),
    description_activite TEXT,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_entreprise (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id INT,
    nom_prenom    VARCHAR(255) NOT NULL,
    fonction      VARCHAR(255),
    telephone     VARCHAR(25),
    email         VARCHAR(255),
    type          ENUM('representant_legal', 'responsable_recrutement') NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contact_entreprise
        FOREIGN KEY (entreprise_id)
        REFERENCES entreprise(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS utilisateur (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL,
    prenom        VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    telephone     VARCHAR(25),
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin', 'manager', 'commercial', 'rh', 'pedagogique') NOT NULL,
    centre        ENUM('nord', 'ouest', 'sud') NOT NULL,
    actif         BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyse_besoin (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id            INT          NOT NULL,
    commercial_id            INT          NOT NULL,
    centre                   ENUM('nord', 'ouest', 'sud') NOT NULL,
    statut                   ENUM('brouillon', 'envoye', 'signe', 'transmis_rh', 'cloture') NOT NULL DEFAULT 'brouillon',

    -- Poste
    domaine                  ENUM('secretariat', 'vente') NOT NULL,
    niveau                   ENUM('bac', 'bac2', 'bac3') NOT NULL,
    intitule_metier          VARCHAR(255),
    localisation_poste       VARCHAR(255),
    nb_postes                INT DEFAULT 1,
    description_missions     TEXT,
    profil_recherche         TEXT,
    competences              TEXT,
    commentaires             TEXT,
    missions_cochees         JSON,

    age_exige                ENUM('18_20', '21_25', '26_29', 'sans_preference'),
    permis                   ENUM('obligatoire', 'optionnel', 'non_requis'),
    experience               ENUM('debutant', 'obligatoire'),

    methode_recrutement      ENUM('tous_cv', 'preselection', 'pre_entretien'),
    pmsmp                    ENUM('oui', 'non', 'a_discuter'),
    jours_formation          JSON,

    engagement_evolution     BOOLEAN DEFAULT FALSE,
    engagement_adaptation    BOOLEAN DEFAULT FALSE,
    engagement_reajustement  BOOLEAN DEFAULT FALSE,
    clause_confidentialite   BOOLEAN DEFAULT FALSE,
    lieu_signature           VARCHAR(255),
    date_signature           DATE,

    yousign_request_id       VARCHAR(255),
    yousign_document_url     TEXT,

    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at                  TIMESTAMP NULL,
    signed_at                TIMESTAMP NULL,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ab_entreprise
        FOREIGN KEY (entreprise_id)
        REFERENCES entreprise(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ab_commercial
        FOREIGN KEY (commercial_id)
        REFERENCES utilisateur(id)
        ON DELETE RESTRICT
);