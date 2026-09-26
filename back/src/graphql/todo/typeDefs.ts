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
        groupId: Int
        createdAt: String!
        updatedAt: String!
    }

    type TodoGroup {
        id: Int!
        userId: Int!
        name: String!
        createdAt: String!
        updatedAt: String!
    }

    input CreateTodoInput {
        title: String!
        description: String
        deadline: String
        status: TodoStatus
        assignedTo: Int
        groupId: Int
        groupName: String
    }

    input UpdateTodoInput {
        title: String
        description: String
        deadline: String
        status: TodoStatus
        groupId: Int
    }

    extend type Query {
        myTodos: [Todo!]!
        myTodoGroups: [TodoGroup!]!
        todoGroupsForUser(userId: Int!): [TodoGroup!]!
    }

    extend type Mutation {
        createTodo(input: CreateTodoInput!): Todo!
        updateTodo(id: Int!, input: UpdateTodoInput!): Todo!
        reorderTodos(orderedIds: [Int!]!): [Todo!]!
        deleteTodo(id: Int!): Boolean!
        createTodoGroup(name: String!, forUserId: Int): TodoGroup!
        changePassword(currentPassword: String!, newPassword: String!): Boolean!
    }
`;
