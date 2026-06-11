-- Add a dedicated status column to companies.
-- Previously the status ("Oui", "Non", "À Réfléchir", ...) was stored in the
-- conclusion column, which also held free-text conclusions: the two values
-- overwrote each other. This migration splits them.

ALTER TABLE companies
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'À Réfléchir' AFTER conclusion;

-- Rows whose conclusion held a status value: move it to status, clear conclusion.
UPDATE companies
SET status = conclusion,
    conclusion = ''
WHERE conclusion IN ('Oui', 'Non', 'À Réfléchir', 'Relance', 'Réponds pas', 'Fermé');

ALTER TABLE companies
    MODIFY conclusion VARCHAR(255) NOT NULL DEFAULT '';
