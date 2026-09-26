import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
// Écrase E2E_DISABLE_LOGIN_RATE_LIMIT si elle est activée dans le .env racine
// (réservée à Playwright) : sous vitest le rate limiter du login reste actif,
// comme en CI. dotenv ne surcharge jamais une variable déjà posée.
process.env.E2E_DISABLE_LOGIN_RATE_LIMIT = 'false';

export default defineConfig({
    test: {
        globals: false,
        setupFiles: ['./test/setup.ts'],
        pool: 'threads',
        // Vitest ≥4 : `poolOptions` supprimé, fichiers séquentiels via fileParallelism.
        // Les tests partagent l'état DB (cf. HOWTOTEST) : jamais de parallélisme.
        fileParallelism: false,
        reporters: process.env.CI ? ['github-actions', 'verbose'] : ['dot', 'json'],
        outputFile: './test/output.json',
    },
});
