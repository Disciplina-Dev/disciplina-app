import gql from 'graphql-tag';

export const UserTypeDefs = gql`
    enum UserRole {
        ADMIN
        COMMERCIAL
        RH
    }

    type User {
        id: Int!
        email: String!
        name: String!
        role: UserRole!
    }

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }
`;
