-- Seed E2E UNIQUEMENT — monté par docker-compose.yaml, jamais en production.
-- Un compte par rôle « staff » loginable, pour dérouler la suite Playwright (e2e/).
-- Mot de passe commun en clair : E2ePassw0rd!  (hash bcrypt versionné ci-dessous).
-- permission_id = 1 (EMPLOYEE) : contrairement à root (ADMIN qui bypasse
-- ProtectedRoute), on veut tester le vrai rendu par rôle.
-- Rôles (mysql-init.sql) : 1=COMMERCIAL 2=RH 3=PEDA 4=AD 5=GESTION.
-- ENTREPRISE n'existe pas ici : c'est un rôle invité JWT-only (ENTREPRISE_GUEST),
-- couvert par token mocké côté Playwright, pas par un user en base.
USE disciplina;

INSERT IGNORE INTO `users` (`email`, `first_name`, `last_name`, `password`, `role_id`, `permission_id`)
VALUES
  ('commercial@e2e.test', 'e2e', 'commercial', '$2b$10$x7tn7lGD89Z4vrAF.bsQaenMPlknl4Xgrh6zCdhddn7gaQ1h3rRDy', 1, 1),
  ('rh@e2e.test',         'e2e', 'rh',         '$2b$10$x7tn7lGD89Z4vrAF.bsQaenMPlknl4Xgrh6zCdhddn7gaQ1h3rRDy', 2, 1),
  ('peda@e2e.test',       'e2e', 'peda',       '$2b$10$x7tn7lGD89Z4vrAF.bsQaenMPlknl4Xgrh6zCdhddn7gaQ1h3rRDy', 3, 1),
  ('admin@e2e.test',      'e2e', 'admin',      '$2b$10$x7tn7lGD89Z4vrAF.bsQaenMPlknl4Xgrh6zCdhddn7gaQ1h3rRDy', 4, 1);
