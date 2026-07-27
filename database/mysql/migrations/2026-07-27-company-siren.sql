ALTER TABLE `companies`
  ADD COLUMN `siren` char(9) GENERATED ALWAYS AS (SUBSTRING(`siret`, 1, 9)) STORED AFTER `siret`,
  ADD KEY `idx_companies_siren` (`siren`);
