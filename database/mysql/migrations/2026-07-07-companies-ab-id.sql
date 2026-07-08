-- Lien vers l'analyse de besoin (AB) stockée dans la collection Mongo `needs_analysis`.
-- Le _id d'un document AB est un UUID applicatif (string), d'où VARCHAR(36).
ALTER TABLE companies ADD COLUMN ab_id VARCHAR(36) DEFAULT NULL AFTER id;
