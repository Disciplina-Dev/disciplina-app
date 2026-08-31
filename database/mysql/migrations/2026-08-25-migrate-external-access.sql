-- Migration: interview_access + match_link + external_link → external_access
-- Idempotent: uses INSERT IGNORE to skip already-migrated rows (keyed on signature).
--
-- Prerequisites:
--   - external_references table must exist with seed rows (1=IMPORT_CV, 2=MATCHING, 3=INTERVIEW_SLOTS)
--   - external_access table must exist with external_email / external_first_name columns
--   - Old tables must still exist (interview_access, match_link, external_link)
--
-- Usage:
--   mysql -u root -p disciplina < database/mysql/migrations/2026-08-25-migrate-external-access.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. interview_access → external_access (reference_id = 3, INTERVIEW_SLOTS)
--    email not available in MySQL → falls back to MongoDB at runtime
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, external_email, external_first_name, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    ia.signature,
    ia.code,
    u.id,
    ia.candidate_id,
    'CANDIDATE',
    NULL,
    NULL,
    3,
    ia.candidate_id,
    ia.status,
    ia.attempts,
    ia.expires_at,
    ia.created_at,
    ia.updated_at
FROM interview_access ia
JOIN users u ON u.email = ia.rh_email;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. external_link → external_access (reference_id = 1, IMPORT_CV)
--    external_email available directly; first_name needs MongoDB at runtime
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, external_email, external_first_name, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    el.signature,
    el.code,
    u.id,
    el.external_uuid,
    el.guest_type,
    el.external_email,
    NULL,
    1,
    el.external_uuid,
    el.status,
    el.attempts,
    el.expires_at,
    el.created_at,
    el.updated_at
FROM external_link el
JOIN users u ON u.email = el.rh_email;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. match_link → external_access (reference_id = 2, MATCHING)
--    company_email = recipient email; first_name needs MongoDB at runtime
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, external_email, external_first_name, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    ml.signature,
    ml.code,
    u.id,
    CAST(c.id AS CHAR),
    'COMPANY',
    ml.company_email,
    NULL,
    2,
    ml.offer_uuid,
    ml.status,
    ml.attempts,
    ml.expires_at,
    ml.created_at,
    ml.updated_at
FROM match_link ml
JOIN users u ON u.email = ml.rh_email
JOIN companies c ON c.email = ml.company_email;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Normalisation des anciennes sessions AUTHENTICATED → PENDING
--    Signaux: sous le nouveau flux, l'authentification passe par un cookie posé à
--    la saisie du code (re-émis au chargement de la page). Une vieille session
--    AUTHENTICATED n'a pas ce cookie: inspect() la rejetterait ("already
--    authenticated") → boucle authenticate ↔ flow. On la repasse donc en PENDING
--    (le code est regénéré + renvoyé à la volée par sendCode), ce qui est sans
--    risque: les démarches réellement soumises restent COMPLETED côté métier.
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE external_access ea
JOIN match_link ml ON ml.signature = ea.signature
SET ea.status = 'PENDING', ea.code = NULL
WHERE ea.status = 'AUTHENTICATED';

UPDATE external_access ea
JOIN external_link el ON el.signature = ea.signature
SET ea.status = 'PENDING', ea.code = NULL
WHERE ea.status = 'AUTHENTICATED';

UPDATE external_access ea
JOIN interview_access ia ON ia.signature = ea.signature
SET ea.status = 'PENDING', ea.code = NULL
WHERE ea.status = 'AUTHENTICATED';

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Verification: count rows before/after
-- ──────────────────────────────────────────────────────────────────────────────
SELECT 'interview_access' AS source, COUNT(*) AS old_count FROM interview_access
UNION ALL
SELECT 'external_link', COUNT(*) FROM external_link
UNION ALL
SELECT 'match_link', COUNT(*) FROM match_link;

SELECT COUNT(*) AS migrated_total FROM external_access;
