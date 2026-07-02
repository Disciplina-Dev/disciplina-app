-- Ajoute les "Préconisations pédagogiques" à l'analyse du besoin :
-- une liste de cases cochées (JSON) + une zone de texte libre "Autre".
ALTER TABLE needs_analysis
    ADD COLUMN pedagogical_recommendations JSON DEFAULT NULL
    AFTER additional_comments;

ALTER TABLE needs_analysis
    ADD COLUMN pedagogical_recommendations_other TEXT DEFAULT NULL
    AFTER pedagogical_recommendations;
