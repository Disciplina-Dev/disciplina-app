import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import { json } from 'stream/consumers';

process.env.NODE_ENV = 'test';
dotenv.config({ path: '.env.back.example', override: true });

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
        reporters: [ 'dot', "json"],
        outputFile: './test/output.json',
    },
});
