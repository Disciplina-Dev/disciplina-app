import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
// Écrase E2E_DISABLE_LOGIN_RATE_LIMIT si elle est activée dans le .env racine
// (réservée à Playwright) : sous vitest le rate limiter du login reste actif,
// comme en CI. dotenv ne surcharge jamais une variable déjà posée.
process.env.E2E_DISABLE_LOGIN_RATE_LIMIT = 'false';
// Sel HKDF de test (GDPR_INF_02.2) : requis par config/env.ts. N'écrase pas une valeur
// déjà fournie (CI via docker-compose.test.yml) ; évite de casser un .env local plus ancien.
process.env.SSN_KDF_SALT ??= '5d1f0c7a9b3e4a68c2d7e1f90b4a3c58e6a7d2b1f4093c8e7a5b6d1c2e3f4a90';

// Clé/sel de test des données de santé (GDPR_INF_02.3), mêmes règles que ci-dessus.
process.env.HEALTH_ENCRYPTION_KEY ??= '7c1e9a4b2d6f38501a9c4e7b3d2f60a85b1c9e4d7a3f2068b5c1d9e4a7f3b206';
process.env.HEALTH_KDF_SALT ??= '3e8a1c5d9b2f4670a1d8c3e5b9f2470d6a1c8e3b5d9f2740c6a1e8d3b5f9270a';

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
