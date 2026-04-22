import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./company/typeDefs";
import { resolvers } from "./company/resolvers";

export const CompanyAPI = new ApolloServer({
    typeDefs,
    resolvers
})