import { ApolloServer } from 'apollo-server-express';
import { typeDefs as companyTypeDefs } from './company/typeDefs';
import { resolvers as companyResolvers } from './company/resolvers';
import { typeDefs as candidateTypeDefs } from './candidate/typeDefs';
import { resolvers as candidateResolvers } from './candidate/resolver';
import { resolvers as jobResolvers } from './jobs/resolver';
import { typeDefs as jobTypeDefs } from './jobs/typeDefs';
import { UserTypeDefs } from './common.typeDefs';
import { jwtContext } from './context';
import { typeDefs as needsAnalysisTypeDefs } from './needsAnalysis/typeDefs';
import { resolvers as needsAnalysisResolvers } from './needsAnalysis/resolvers';
import { todoTypeDefs } from './todo/typeDefs';
import { todoResolvers } from './todo/resolver';

const combinedCompanyResolvers = {
    Query: {
        ...companyResolvers.Query,
        ...needsAnalysisResolvers.Query,
        ...todoResolvers.Query,
    },
    Mutation: {
        ...companyResolvers.Mutation,
        ...needsAnalysisResolvers.Mutation,
        ...todoResolvers.Mutation,
    },
};

export const CompanyAPI = new ApolloServer({
    typeDefs: [UserTypeDefs, companyTypeDefs, needsAnalysisTypeDefs, todoTypeDefs],
    resolvers: combinedCompanyResolvers,
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
