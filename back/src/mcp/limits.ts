// Plafonds anti-export en masse (RGPD Art. 5.1.c / 32, MCP_RGPD_AUDIT.md M5).
// Une page ne dépasse jamais MAX_PAGE_SIZE fiches ; un utilisateur (ou la clé
// statique, id 0) est borné sur 24 h glissantes, indépendamment de son IP.
export const MAX_PAGE_SIZE = 50;
export const DAILY_CALL_LIMIT = 1000;
export const DAILY_RECORD_LIMIT = 2000;
