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
        // En CI, le rapport JSON est écrit dans test-results/ (monté hors du conteneur par
        // docker-compose.test.yml) puis rendu en tableau dans le résumé du run GitHub
        // par .github/scripts/vitest-summary.mjs.
        reporters: process.env.CI ? ['github-actions', 'verbose', 'json'] : ['dot', 'json'],
        outputFile: process.env.CI ? './test-results/vitest.json' : './test/output.json',
    },
});
