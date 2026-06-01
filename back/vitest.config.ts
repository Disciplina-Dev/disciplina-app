import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import { json } from 'stream/consumers';

process.env.NODE_ENV = 'test';

export default defineConfig({
    test: {
        globals: false,
        setupFiles: ['./test/setup.ts'],
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true,
            },
        },
        reporters: process.env.CI ? ['github-actions', 'verbose'] : ['dot', 'json'],
        outputFile: './test/output.json',
    },
});
