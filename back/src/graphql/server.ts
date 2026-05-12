import { ApolloServer } from 'apollo-server-express';
import { typeDefs as companyTypeDefs } from './company/typeDefs';
import { resolvers as companyResolvers } from './company/resolvers';
import { typeDefs as candidateTypeDefs } from './candidate/typeDefs';
import { resolvers as candidateResolvers } from './candidate/resolver';
import { resolvers as jobResolvers } from './jobs/resolver';
import { typeDefs as jobTypeDefs } from './jobs/typeDefs';
import { jwtContext } from './context';

export const CompanyAPI = new ApolloServer({
    typeDefs: companyTypeDefs,
    resolvers: companyResolvers,
    context: jwtContext,
});

export const CandidateAPI = new ApolloServer({
    typeDefs: candidateTypeDefs,
    resolvers: candidateResolvers,
    context: jwtContext,
});

export const JobAPI = new ApolloServer({
    typeDefs: jobTypeDefs,
    resolvers: jobResolvers,
    context: jwtContext,
});
