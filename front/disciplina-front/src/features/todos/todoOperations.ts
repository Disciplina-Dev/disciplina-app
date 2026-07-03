import { gql } from 'urql'

export const MY_TODOS_QUERY = gql`
  query MyTodos {
    myTodos {
      id userId title description deadline position status source sourceRef createdAt updatedAt
    }
  }
`

export const CREATE_TODO_MUTATION = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id userId title description deadline position status source sourceRef createdAt updatedAt
    }
  }
`

export const UPDATE_TODO_MUTATION = gql`
  mutation UpdateTodo($id: Int!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      id userId title description deadline position status source sourceRef createdAt updatedAt
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
