import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./company/typeDefs";
import { resolvers } from "./company/resolvers";
import { typeDefs as candidateTypeDefs } from "./candidate/typeDefs";
import { resolvers as candidateResolvers } from "./candidate/resolver";

export const CompanyAPI = new ApolloServer({
    typeDefs,
    resolvers
})

export const CandidateAPI = new ApolloServer({
    typeDefs: candidateTypeDefs,
    resolvers: candidateResolvers,
})