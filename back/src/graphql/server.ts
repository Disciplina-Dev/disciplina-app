import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./typeDefs";
import { resolvers } from "./resolvers";

export const CompanyAPI = new ApolloServer({
    typeDefs,
    resolvers
})