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
import { CSRF_HEADER } from '../rest/middleware/tokenAuth';

// Apollo v5 active sa protection CSRF par défaut, mais le client ne pose que
// l'en-tête x-csrf-token (double-submit, déjà validé par le middleware CSRF de
// l'app) et pas ceux recommandés par Apollo. On l'ajoute aux en-têtes reconnus
// pour éviter les faux positifs sur les requêtes sans Content-Type (GET urql).
const csrfPrevention = { requestHeaders: [CSRF_HEADER] };

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
    csrfPrevention,
});

export const NeedsAnalysisAPI = new ApolloServer({
    typeDefs: [UserTypeDefs, needsAnalysisTypeDefs],
    resolvers: needsAnalysisResolvers,
    csrfPrevention,
});

export const CandidateAPI = new ApolloServer({
    typeDefs: candidateTypeDefs,
    resolvers: candidateResolvers,
    csrfPrevention,
});

export const OfferAPI = new ApolloServer({
    typeDefs: offerTypeDefs,
    resolvers: offerResolvers,
    csrfPrevention,
});
