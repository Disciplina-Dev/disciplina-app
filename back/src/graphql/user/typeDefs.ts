import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  enum Role {
    ADMIN
    COMMERCIAL
    RH
  }

  type User {
    id: Int!
    email: String!
    name: String!
    role: Role!
    sectors: [String]
    oauthToken: String
    refreshToken: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
  }

  type Mutation {
    register(email: String!, name: String!, passwordPlain: String!, role: Role!, sectors: [String]): User!
    login(email: String!, passwordPlain: String!): AuthPayload!
    linkGoogleDrive(code: String!): User!
  }
`;
