-- Commercial KPI tracking, imported from the "Suivi commercial" Excel files
-- (C.R Mois / C.R Sem. sheets) or maintained manually. One row per
-- commercial x year x month x site.
-- companies.status is VARCHAR(50) (not ENUM), so the new 'Oui OF' status
-- needs no schema change there.

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

    UNIQUE KEY unique_kpi (user_name, year, month, week, site),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);
