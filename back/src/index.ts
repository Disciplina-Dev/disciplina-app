import express from 'express';
import dotenv from 'dotenv';
import { CompanyAPI, CandidateAPI } from './graphql/server';
import { connectMongoDB } from './db/mongodb/connection';

dotenv.config();

async function startServer() {
  const app: any = express();
  const PORT = process.env.API_PORT;

  await connectMongoDB();

  await CompanyAPI.start();
  CompanyAPI.applyMiddleware({ app, path: '/api/graphql/companies' });

  await CandidateAPI.start();
  CandidateAPI.applyMiddleware({ app, path: '/api/graphql/candidates' });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);