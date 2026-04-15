import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app: any = express();
  const PORT = process.env.API_PORT;

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  server.applyMiddleware({ app, path: '/api/graphql/companies' });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/api/graphql/companies`);
  });
}

startServer().catch(console.error);