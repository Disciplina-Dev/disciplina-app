import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { CompanyAPI, CandidateAPI, UserAPI } from './graphql/server';
import { connectMongoDB } from './db/mongodb/connection';
import session from 'express-session';
import cors from 'cors';
import { google } from 'googleapis';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI || 'http://localhost:4000/auth/callback'
);

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

  app.get('/auth/google', (req: Request, res: Response) => {
    try {
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      res.redirect(url);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error');
    }
  });

  app.get('/auth/callback', async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session.tokens = tokens;
      res.redirect('http://localhost:5173/drive');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error');
    }
  });

  app.get('/api/files', async (req: Request, res: Response): Promise<any> => {
    try {
      if (!req.session.tokens) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      oauth2Client.setCredentials(req.session.tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const response = await drive.files.list({
        fields: 'files(id, name, mimeType, size, modifiedTime)',
      });
      
      res.json(response.data.files);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

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