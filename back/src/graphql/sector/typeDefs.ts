import gql from 'graphql-tag';

export const sectorTypeDefs = gql`
    type Sector {
        id: Int!
        code: String!
        label: String!
        level: String!
        parentId: Int
        communes: [Sector!]!
    }

    extend type Query {
        sectors(level: String, parentId: Int): [Sector!]!
    }
`;
