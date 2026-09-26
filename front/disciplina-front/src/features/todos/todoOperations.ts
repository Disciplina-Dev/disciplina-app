import { gql } from 'urql'

export const MY_TODOS_QUERY = gql`
  query MyTodos {
    myTodos {
      id userId assignedBy title description deadline position status source sourceRef groupId createdAt updatedAt
    }
  }
`

export const MY_TODO_GROUPS_QUERY = gql`
  query MyTodoGroups {
    myTodoGroups {
      id userId name createdAt updatedAt
    }
  }
`

export const TODO_GROUPS_FOR_USER_QUERY = gql`
  query TodoGroupsForUser($userId: Int!) {
    todoGroupsForUser(userId: $userId) {
      id userId name createdAt updatedAt
    }
  }
`

export const CREATE_TODO_MUTATION = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id userId assignedBy title description deadline position status source sourceRef groupId createdAt updatedAt
    }
  }
`

export const UPDATE_TODO_MUTATION = gql`
  mutation UpdateTodo($id: Int!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      id userId assignedBy title description deadline position status source sourceRef groupId createdAt updatedAt
    }
  }
`

export const CREATE_TODO_GROUP_MUTATION = gql`
  mutation CreateTodoGroup($name: String!, $forUserId: Int) {
    createTodoGroup(name: $name, forUserId: $forUserId) {
      id userId name createdAt updatedAt
    }
  }
`

export const REORDER_TODOS_MUTATION = gql`
  mutation ReorderTodos($orderedIds: [Int!]!) {
    reorderTodos(orderedIds: $orderedIds) {
      id position
    }
  }
`

export const DELETE_TODO_MUTATION = gql`
  mutation DeleteTodo($id: Int!) {
    deleteTodo(id: $id)
  }
`
