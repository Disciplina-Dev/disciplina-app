import { ApolloServer } from "apollo-server-express";
import { typeDefs as companyTypeDefs } from "./company/typeDefs";
import { resolvers as companyResolvers } from "./company/resolvers";
import { typeDefs as candidateTypeDefs } from "./candidate/typeDefs";
import { resolvers as candidateResolvers } from "./candidate/resolver";
import { typeDefs as userTypeDefs } from "./user/typeDefs";
import { resolvers as userResolvers } from "./user/resolvers";
import { resolvers as jobResolvers } from "./jobs/resolver";
import { typeDefs as jobTypeDefs } from "./jobs/typeDefs";
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

const contextMiddleware = ({ req }: any) => {
  const token = req.headers.authorization?.split(' ')[1] || '';
  if (token) {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      return { user };
    } catch (e) {
      console.warn("Invalid token", e);
    }
  }
  return { user: null };
};

export const CompanyAPI = new ApolloServer({
    typeDefs: companyTypeDefs,
    resolvers: companyResolvers,
    context: contextMiddleware
});

export const CandidateAPI = new ApolloServer({
    typeDefs: candidateTypeDefs,
    resolvers: candidateResolvers,
    context: contextMiddleware
});

export const UserAPI = new ApolloServer({
    typeDefs: userTypeDefs,
    resolvers: userResolvers,
    context: contextMiddleware
});

export const JobAPI = new ApolloServer({
  typeDefs: jobTypeDefs,
  resolvers: jobResolvers,
  // context: contextMiddleware
})