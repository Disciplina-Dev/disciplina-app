import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import abRouter from './routes/ab';
import webhooksRouter from './routes/webhooks';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app: any = express();
  const PORT = process.env.API_PORT;

  // CORS
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json());

  // REST routes
  app.use('/api/ab', abRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/ressources', express.static('/ressources'));

  // GraphQL
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app, path: '/api/graphql/companies' });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}`);
    console.log(`  GraphQL → /api/graphql/companies`);
    console.log(`  REST    → /api/ab`);
  });
}

startServer().catch(console.error);