import gql from 'graphql-tag';

export const todoTypeDefs = gql`
    enum TodoStatus {
        TODO
        IN_PROGRESS
        DONE
    }

    enum TodoSource {
        MANUAL
        SYSTEM
    }

    type Todo {
        id: Int!
        userId: Int!
        assignedBy: Int
        title: String!
        description: String
        deadline: String
        position: Int!
        status: TodoStatus!
        source: TodoSource!
        sourceRef: String
        createdAt: String!
        updatedAt: String!
    }

    input CreateTodoInput {
        title: String!
        description: String
        deadline: String
        status: TodoStatus
        assignedTo: Int
    }

    input UpdateTodoInput {
        title: String
        description: String
        deadline: String
        status: TodoStatus
    }

    extend type Query {
        myTodos: [Todo!]!
    }

    extend type Mutation {
        createTodo(input: CreateTodoInput!): Todo!
        updateTodo(id: Int!, input: UpdateTodoInput!): Todo!
        reorderTodos(orderedIds: [Int!]!): [Todo!]!
        deleteTodo(id: Int!): Boolean!
        changePassword(currentPassword: String!, newPassword: String!): Boolean!
    }
`;
