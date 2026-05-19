import { beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { startServer } from '../src/index';
import { CompanyAPI, CandidateAPI, JobAPI } from '../src/graphql/server';
import { dropMongo } from './helpers/db';

let server: http.Server;

beforeAll(async () => {
    server = await startServer();
}, 30000);

beforeEach(async () => {
    await dropMongo();
});

afterAll(async () => {
    await Promise.all([
        CompanyAPI.stop(),
        CandidateAPI.stop(),
        JobAPI.stop(),
    ]);
    await mongoose.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
});
