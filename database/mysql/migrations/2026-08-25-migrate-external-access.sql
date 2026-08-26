-- Migration: interview_access + match_link + external_link → external_access
-- Idempotent: uses INSERT IGNORE to skip already-migrated rows (keyed on signature).
--
-- Prerequisites:
--   - external_references table must exist with seed rows (1=IMPORT_CV, 2=MATCHING, 3=INTERVIEW_SLOTS)
--   - external_access table must exist
--   - Old tables must still exist (interview_access, match_link, external_link)
--
-- Usage:
--   mysql -u root -p disciplina < database/mysql/migrations/2026-08-25-migrate-external-access.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. interview_access → external_access (reference_id = 3, INTERVIEW_SLOTS)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    ia.signature,
    ia.code,
    u.id,
    ia.candidate_id,
    'CANDIDATE',
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
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    el.signature,
    el.code,
    u.id,
    el.external_uuid,
    el.guest_type,
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
--    external_id = company MySQL id (cast to string), guest = COMPANY
-- ──────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO external_access
    (signature, code, user_id, external_id, external_type, reference_id, reference_key, status, attempts, expires_at, created_at, updated_at)
SELECT
    ml.signature,
    ml.code,
    u.id,
    CAST(c.id AS CHAR),
    'COMPANY',
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
-- 4. Verification: count rows before/after
-- ──────────────────────────────────────────────────────────────────────────────
SELECT 'interview_access' AS source, COUNT(*) AS old_count FROM interview_access
UNION ALL
SELECT 'external_link', COUNT(*) FROM external_link
UNION ALL
SELECT 'match_link', COUNT(*) FROM match_link;

SELECT COUNT(*) AS migrated_total FROM external_access;
