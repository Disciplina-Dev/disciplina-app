import { ApolloServer } from '@apollo/server';
import { typeDefs as companyTypeDefs } from './company/typeDefs';
import { resolvers as companyResolvers } from './company/resolvers';
import { typeDefs as candidateTypeDefs } from './candidate/typeDefs';
import { resolvers as candidateResolvers } from './candidate/resolver';
import { resolvers as offerResolvers } from './offers/resolver';
import { typeDefs as offerTypeDefs } from './offers/typeDefs';
import { UserTypeDefs } from './common.typeDefs';
import { typeDefs as needsAnalysisTypeDefs } from './needsAnalysis/typeDefs';
import { resolvers as needsAnalysisResolvers } from './needsAnalysis/resolvers';
import { todoTypeDefs } from './todo/typeDefs';
import { todoResolvers } from './todo/resolver';

const combinedCompanyResolvers = {
    Query: {
        ...companyResolvers.Query,
        ...todoResolvers.Query,
    },
    Mutation: {
        ...companyResolvers.Mutation,
        ...todoResolvers.Mutation,
    },
};

export const CompanyAPI = new ApolloServer({
    typeDefs: [UserTypeDefs, companyTypeDefs, todoTypeDefs],
    resolvers: combinedCompanyResolvers,
});

export const NeedsAnalysisAPI = new ApolloServer({
    typeDefs: [UserTypeDefs, needsAnalysisTypeDefs],
    resolvers: needsAnalysisResolvers,
});

export const CandidateAPI = new ApolloServer({
    typeDefs: candidateTypeDefs,
    resolvers: candidateResolvers,
});

export const OfferAPI = new ApolloServer({
    typeDefs: offerTypeDefs,
    resolvers: offerResolvers,
});
