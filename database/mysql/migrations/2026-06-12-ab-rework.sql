-- Migration: refonte de l'analyse du besoin (AB) côté commercial.
-- - `positions` : liste JSON de postes (domaine, intitulé, missions, localisation par poste)
-- - `age_min` / `age_max` : remplace les tranches d'âge fixes (age_requirements conservé pour les anciennes lignes)
-- - `conditions` : texte libre remplaçant les cases à cocher schedule_options
-- - `education_level` : devient optionnel (champ supprimé du formulaire)
USE disciplina;

ALTER TABLE needs_analysis
    ADD COLUMN positions JSON DEFAULT NULL AFTER positions_count,
    ADD COLUMN age_min INT DEFAULT NULL AFTER age_requirements,
    ADD COLUMN age_max INT DEFAULT NULL AFTER age_min,
    ADD COLUMN conditions TEXT DEFAULT NULL AFTER schedule_options,
    MODIFY COLUMN education_level ENUM('BAC', 'BAC_PLUS_2', 'BAC_PLUS_3') DEFAULT NULL;
