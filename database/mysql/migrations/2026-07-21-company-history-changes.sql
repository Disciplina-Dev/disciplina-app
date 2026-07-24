-- Store per-field before/after values for each company update, so the timeline
-- can render "champ X : ancienne valeur → nouvelle valeur".
-- Shape: JSON array of { "column": string, "from": string|null, "to": string|null }.

USE disciplina;

ALTER TABLE company_history
    ADD COLUMN IF NOT EXISTS changes JSON DEFAULT NULL;
