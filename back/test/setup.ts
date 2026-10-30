import { beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import net from 'net';
import mongoose from 'mongoose';
import { startServer } from '../src/index';
import { env } from '../src/config/env';
import { CompanyAPI, CandidateAPI, OfferAPI, NeedsAnalysisAPI, PedaAPI } from '../src/graphql/server';
import { dropMongo } from './helpers/db';
import { closeMySQL } from '../src/db/mysql/connection';

let server: http.Server;

/**
 * `env.API_PORT` (4000) est aussi le port publié par la stack dev
 * (`docker compose up`). S'il est déjà pris, `app.listen` échoue en arrière-plan
 * et **tous** les `fetch()` des tests tombent sur l'autre serveur : les suites
 * échouent alors sur des 404/HTML trompeurs au lieu de signaler le conflit.
 * On vérifie donc le port avant de démarrer, pour échouer franchement.
 */
async function assertApiPortFree(port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', (err: NodeJS.ErrnoException) => {
            reject(
                new Error(
                    `Le port ${port} (API_PORT) est déjà utilisé — le plus souvent la stack dev ` +
                        `(docker compose up publie 4000). Arrête-la ou lance les tests avec ` +
                        `API_PORT=<port libre>, sinon les fetch() visent ce serveur et non celui des tests.`,
                    { cause: err },
                ),
            );
        });
        probe.listen(port, '0.0.0.0', () => probe.close(() => resolve()));
    });
}

beforeAll(async () => {
    await assertApiPortFree(env.API_PORT);
    server = await startServer();
}, 30000);

beforeEach(async () => {
    await dropMongo();
});

function timeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
    return Promise.race([p, new Promise<undefined>((r) => setTimeout(r, ms))]);
}

afterAll(async () => {
    await timeout(CompanyAPI.stop(), 3000).catch(() => {});
    await timeout(CandidateAPI.stop(), 3000).catch(() => {});
    await timeout(OfferAPI.stop(), 3000).catch(() => {});
    await timeout(NeedsAnalysisAPI.stop(), 3000).catch(() => {});
    await timeout(PedaAPI.stop(), 3000).catch(() => {});
    await timeout(mongoose.disconnect(), 3000).catch(() => {});
    if (server) {
        await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 3000);
            server.close(() => {
                clearTimeout(timer);
                resolve();
            });
        });
    }
    await timeout(closeMySQL(), 3000).catch(() => {});
}, 20000);
