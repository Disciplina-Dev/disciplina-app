-- Ajoute "Comment a-t-il connu DISCIPLINA ?" à l'analyse du besoin.
ALTER TABLE needs_analysis
    ADD COLUMN referral_source ENUM(
        'KOANN', 'E2CR', 'FRANCE_TRAVAIL', 'TELEVISION_PUB', 'BOUCHE_A_OREILLE',
        'MISSION_LOCALE', 'SALON', 'RSMA', 'RESEAUX_SOCIAUX'
    ) DEFAULT NULL
    AFTER opco;
