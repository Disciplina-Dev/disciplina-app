-- Ajoute le type d'OPCO de l'entreprise à l'analyse du besoin.
ALTER TABLE needs_analysis
    ADD COLUMN opco ENUM(
        'AKTO', 'ATLAS', 'AFDAS', 'CONSTRUCTYS', 'OCAPIAT', 'OPCO_2I',
        'OPCO_EP', 'OPCO_MOBILITES', 'OPCO_SANTE', 'OPCOMMERCE', 'UNIFORMATION'
    ) DEFAULT NULL
    AFTER company_description;
