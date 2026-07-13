import { beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { startServer } from '../src/index';
import { CompanyAPI, CandidateAPI, OfferAPI, NeedsAnalysisAPI } from '../src/graphql/server';
import { dropMongo } from './helpers/db';

let server: http.Server;

beforeAll(async () => {
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
    await timeout(mongoose.disconnect(), 3000).catch(() => {});
    await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        server.close(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}, 20000);
