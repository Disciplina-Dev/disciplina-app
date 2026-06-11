-- Migration: les secteurs deviennent des zones (Nord-Est, Ouest, Sud).
-- L'ancienne valeur (commune, ex: Saint-Denis) est déplacée dans les notes,
-- puis le secteur est remis à la valeur par défaut 'Nord-Est' (à ajuster à la main).
USE disciplina;

UPDATE companies
SET notes = CONCAT_WS('\n', CONCAT('Commune: ', sector), NULLIF(notes, '')),
    sector = 'Nord-Est'
WHERE sector NOT IN ('Nord-Est', 'Ouest', 'Sud');
