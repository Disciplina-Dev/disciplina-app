import './config/env'; // validate env vars at startup
import express, { Request, Response } from 'express';
import http from 'http';
import { CompanyAPI, CandidateAPI, JobAPI } from './graphql/server';
import { connectMongoDB } from './db/mongo/connection';
import session from 'express-session';
import cors from 'cors';

import { router as authRouter } from './rest/auth/route';
import { router as emailRouter } from './rest/email/route';
import { router as relanceRouter } from './rest/relance/route';
import { router as classmarkerRouter } from './rest/classmarker/route';
import { router as classmarkerWebhookRouter } from './rest/classmarker/webhook.route';
import { router as candidatesRestRouter } from './rest/candidates/route';
import { errorHandler } from './rest/middleware/errorHandler';
import { emailRateLimiter, relanceRateLimiter } from './rest/middleware/rateLimiter';
import { logger } from './external/logger/logger';
import { env } from './config/env';

import { FilizAuthClient } from './external/filiz/auth-client';
declare module 'express-session' {
    interface SessionData {
        tokens: any;
    }
}

export async function startServer(): Promise<http.Server> {
    const app: any = express();

    app.use(
        cors({
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true,
        }),
    );

    app.use(
        session({
            secret: env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
        }),
    );

    app.use('/api/email/send', emailRateLimiter);
    app.use(emailRouter);
    app.use('/api/relance/send', relanceRateLimiter);
    app.use(relanceRouter);

    app.get('/api/logout', (req: Request, res: Response) => {
        req.session.destroy(() => {
            res.status(200).json({ message: 'Logged out' });
        });
    });

    app.use('/api/auth', authRouter);
    app.use('/api/classmarker', classmarkerRouter);
    app.use('/api/webhooks', classmarkerWebhookRouter);
    app.use('/api/candidates', candidatesRestRouter);
    app.use(errorHandler);

    await connectMongoDB();

    await CompanyAPI.start();
    CompanyAPI.applyMiddleware({ app, path: '/api/graphql/companies' });

    await CandidateAPI.start();
    CandidateAPI.applyMiddleware({ app, path: '/api/graphql/candidates' });

    await JobAPI.start();
    JobAPI.applyMiddleware({ app, path: '/api/graphql/jobs' });

    const server = app.listen(env.API_PORT, () => {
        logger.info(`Server ready at http://localhost:${env.API_PORT}`);
    });
    return server;
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch((err) => logger.error(err, 'Startup error'));
}
