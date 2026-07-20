import gql from 'graphql-tag';

export const UserTypeDefs = gql`
    enum UserRole {
        COMMERCIAL
        RH
        PEDA
        AD
        GESTION
    }

    enum Permission {
        EMPLOYEE
        RESPONSABLE
        ADMIN
    }

    type User {
        id: Int!
        email: String!
        firstName: String!
        lastName: String!
        role: UserRole!
        permission: Permission!
    }

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }
`;
