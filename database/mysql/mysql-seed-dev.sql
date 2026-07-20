-- Seed DEV UNIQUEMENT — monté par docker-compose.yaml (base), jamais en production.
-- Compte administrateur de bootstrap pour le développement local.
-- Mot de passe = hash bcrypt connu et versionné : ne doit exister sur aucun
-- environnement exposé (cf. RAPPORT.md E1 / REMEDIATION.md §5).
USE disciplina;

INSERT IGNORE INTO `users` (`email`, `first_name`, `last_name`, `password`, `role_id`, `permission_id`)
  VALUE (
    'root@example.com',
    'root',
    'root',
    '$2a$10$3cXr1oA.UaFA44D4OjddWupCC3c4vFBoPZhewTxohLKUvMrHJ52nq',
    5,
    3
  );
