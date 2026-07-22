import './config/env'; // validate env vars at startup
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { CompanyAPI, CandidateAPI, OfferAPI, NeedsAnalysisAPI } from './graphql/server';
import { connectMySQL } from './db/mysql/connection';
import { runMysqlMigrations } from './db/mysql/migrations';
import { connectMongoDB } from './db/mongo/connection';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';

import { router as authRouter } from './rest/auth/route';
import { router as emailRouter } from './rest/email/route';
import { router as relanceRouter } from './rest/relance/route';
import { router as classmarkerRouter } from './rest/classmarker/route';
import { router as classmarkerWebhookRouter } from './rest/classmarker/webhook.route';
import { router as candidatesRestRouter } from './rest/candidates/route';
import { router as sourcingRouter } from './rest/sourcing/route';
import { router as yousignWebhookRouter } from './rest/yousign/route';
import { router as docusealWebhookRouter } from './rest/docuseal/route';
import { router as kpiRouter } from './rest/kpi/route';
import { router as rhKpiRouter } from './rest/rh-kpi/route';
import { router as needsAnalysisRouter } from './rest/needsAnalysis/route';
import { router as matchingRouter } from './rest/matching/route';
import { router as notificationsRouter } from './rest/notifications/route';
import { router as calendarRouter } from './rest/calendar/route';
import { router as bookingRouter } from './rest/booking/route';
import { router as mailTemplatesRouter } from './rest/mailTemplates/route';
import { router as matchRouter } from './rest/match/route';
import { router as interviewRouter } from './rest/interview/route';
import { router as externalRouter } from './rest/external/route';
import { router as filizRouter } from './rest/filiz/route';
import { router as sectorSettingsRouter } from './rest/sectorSettings/route';
import { router as pedaRouter } from './rest/peda/route';
import { startPedaDraftScheduler } from './scheduler/pedaDraftScheduler';
import { startImmersionEndScheduler } from './scheduler/immersionEndScheduler';
import { MailTemplateService } from './services/MailTemplateService';
import { router as mcpRouter } from './mcp/route';
import { errorHandler } from './rest/middleware/errorHandler';
import { emailRateLimiter, relanceRateLimiter, graphqlRateLimiter } from './rest/middleware/rateLimiter';
import { httpLogger } from './rest/middleware/httpLogger';
import { logger } from './external/logger';
import { env } from './config/env';

declare module 'express-session' {
    interface SessionData {
        tokens: any;
    }
}

export async function createApp(): Promise<express.Express> {
    const app: any = express();

    const isProduction = env.NODE_ENV === 'production';

    // Hors production il n'y a pas de proxy : faire confiance à X-Forwarded-For
    // laisserait n'importe qui forger son IP et contourner les rate limits.
    if (isProduction) app.set('trust proxy', 1);

    // CSP coupée hors production (elle casse la sandbox Apollo), HSTS aussi
    // (le navigateur mémorise l'en-tête et force ensuite https://localhost).
    app.use(
        helmet({
            contentSecurityPolicy: isProduction ? undefined : false,
            hsts: isProduction ? undefined : false,
        }),
    );

    app.use(httpLogger);

    app.use(
        cors({
            origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
                // No Origin header: same-origin, curl, server-to-server
                if (!origin) return callback(null, true);
                if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
                return callback(new Error(`CORS: origin ${origin} not allowed`));
            },
            credentials: true,
        }),
    );

    app.use(
        session({
            secret: env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            },
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
    app.use('/api/sourcing', sourcingRouter);
    app.use(yousignWebhookRouter);
    app.use(docusealWebhookRouter);
    app.use('/api/kpi', kpiRouter);
    app.use('/api/rh-kpi', rhKpiRouter);
    app.use('/api/needs-analysis', needsAnalysisRouter);
    app.use(matchingRouter);
    app.use('/api/notifications', notificationsRouter);
    app.use('/api/calendar', calendarRouter);
    app.use('/api/booking', bookingRouter);
    app.use('/api/mail-templates', mailTemplatesRouter);
    app.use('/api/match', matchRouter);
    app.use('/api/interview', interviewRouter);
    app.use('/api/external', externalRouter);
    app.use('/api/filiz', filizRouter);
    app.use('/api/sector-settings', sectorSettingsRouter);
    app.use('/api/peda', pedaRouter);
    app.use(mcpRouter);
    app.use(errorHandler);

    await connectMySQL();
    await runMysqlMigrations();
    await connectMongoDB();

    app.use('/api/graphql', graphqlRateLimiter);

    // Prevent browser/proxy caching of GraphQL responses (auth-sensitive data)
    app.use('/api/graphql', (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });

    await CompanyAPI.start();
    CompanyAPI.applyMiddleware({ app, path: '/api/graphql/companies' });

    await CandidateAPI.start();
    CandidateAPI.applyMiddleware({ app, path: '/api/graphql/candidates' });

    await OfferAPI.start();
    OfferAPI.applyMiddleware({ app, path: '/api/graphql/offers' });

    await NeedsAnalysisAPI.start();
    NeedsAnalysisAPI.applyMiddleware({ app, path: '/api/graphql/needs-analysis' });

    return app;
}

export async function startServer(): Promise<http.Server> {
    const app = await createApp();
    const server = app.listen(env.API_PORT, () => {
        logger.info(`Server ready at http://localhost:${env.API_PORT}`);
    });
    // Modèles de relance d'absence par défaut (idempotent, une seule fois).
    const mailTemplateService = new MailTemplateService();
    mailTemplateService
        .seedPedaDefaults()
        .catch((err) => logger.error({ err }, 'peda-templates: seed des modèles par défaut échoué'));
    mailTemplateService
        .seedAbSignatureDefault()
        .catch((err) => logger.error({ err }, 'ab-signature: seed du modèle système échoué'));
    mailTemplateService
        .seedCvImportDefault()
        .catch((err) => logger.error({ err }, 'cv-import: seed du modèle par défaut échoué'));
    startPedaDraftScheduler();
    startImmersionEndScheduler();
    return server;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    startServer().catch((err) => logger.error({ err }, 'Startup error'));
}
