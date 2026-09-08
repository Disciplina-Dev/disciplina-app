-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2026-08-28 : sessions matching — match_link → external_access
--
-- Le workflow « sélection de candidats » n'utilise plus la table `match_link` :
-- chaque session vit désormais dans `external_access` avec `reference_id = 2`
-- (MATCHING, cf. table `external_references`).
--
-- Principes de reproduction :
--   * la signature est conservée à l'identique : les liens déjà envoyés aux
--     entreprises continuent de fonctionner (l'URL passe sur /external/authenticate) ;
--   * le code est remis à NULL pour les sessions non terminées : il est généré et
--     envoyé automatiquement au premier chargement de la page (workflow external) ;
--   * status : COMPLETED/LOCKED conservés, tout le reste redevient SENDING ;
--   * user_id résolu via `rh_email` → `users.email`, sinon repli sur le plus petit
--     identifiant d'utilisateur (la table est temporaire, DÉPRECATED).
--
-- Les lignes de test (emails @test.local) sont volontairement exclues.
-- La table `match_link` est conservée (période DÉPRECATED) ; elle ne reçoit plus
-- de nouvelles lignes.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO `external_access`
    (`signature`, `code`, `user_id`, `external_id`, `external_type`, `external_email`,
     `external_first_name`, `reference_id`, `reference_key`, `status`, `attempts`, `expires_at`)
SELECT
    ml.`signature`,
    NULL                                        AS `code`,
    COALESCE(u.id, (SELECT MIN(id) FROM users)) AS `user_id`,
    ml.`offer_uuid`                             AS `external_id`,
    'COMPANY'                                   AS `external_type`,
    ml.`company_email`                          AS `external_email`,
    NULL                                        AS `external_first_name`,
    2                                           AS `reference_id`,
    ml.`offer_uuid`                             AS `reference_key`,
    CASE
        WHEN ml.`status` = 'COMPLETED' THEN 'COMPLETED'
        WHEN ml.`status` = 'LOCKED'    THEN 'LOCKED'
        ELSE 'SENDING'
    END                                         AS `status`,
    0                                           AS `attempts`,
    ml.`expires_at`
FROM        `match_link` ml
LEFT JOIN   `users` u ON u.email = ml.`rh_email`
WHERE       ml.`rh_email` NOT LIKE '%@test.local'
  AND       ml.`company_email` NOT LIKE '%@test.local'
  AND       u.is_deleted = 0;