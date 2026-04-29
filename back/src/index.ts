import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { CompanyAPI, CandidateAPI, UserAPI } from './graphql/server';
import { connectMongoDB } from './db/mongodb/connection';
import session from 'express-session';
import cors from 'cors';
import { router as googleRouter } from './rest/google/route';
import { router as filesRouter } from './rest/files/route';
import { router as emailRouter } from './rest/email/route';
import { router as relanceRouter } from './rest/relance/route';

dotenv.config();

declare module 'express-session' {
    interface SessionData {
        tokens: any;
    }
}

async function startServer() {
    const app: any = express();
    const PORT = process.env.API_PORT || 4000;

    app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
    }));

    app.use(session({
        secret: process.env.SESSION_SECRET || 'supersecret123',
        resave: false,
        saveUninitialized: false,
    }));

    app.use(googleRouter);
    app.use('/api/files', filesRouter);
    app.use(emailRouter);
    app.use(relanceRouter);

    app.get('/api/logout', (req: Request, res: Response) => {
        req.session.destroy(() => {
            res.status(200).json({ message: 'Logged out' });
        });
    });

    await connectMongoDB();

    await CompanyAPI.start();
    CompanyAPI.applyMiddleware({ app, path: '/api/graphql/companies' });

    await CandidateAPI.start();
    CandidateAPI.applyMiddleware({ app, path: '/api/graphql/candidates' });

  await UserAPI.start();
  UserAPI.applyMiddleware({ app, path: '/api/graphql/users' });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);