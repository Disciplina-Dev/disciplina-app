import express from 'express';
import dotenv from 'dotenv';
import { CompanyAPI } from './graphql/server';

dotenv.config();

async function startServer() {
  const app: any = express();
  const PORT = process.env.API_PORT;

  await CompanyAPI.start();

  CompanyAPI.applyMiddleware({ app, path: '/api/graphql/companies' });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/api/graphql/companies`);
  });
}

startServer().catch(console.error);