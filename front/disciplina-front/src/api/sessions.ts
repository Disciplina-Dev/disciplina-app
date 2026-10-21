import { gql } from 'urql'
import { pedaGraphqlClient } from '@/graphql/client'
import type { Alternant } from '@/types/alternant'
import type { CreateSessionInput, Session, UpdateSessionInput } from '@/types/session'

const SESSION_FIELDS = gql`
  fragment SessionFields on Session {
    id
    nom
    filiere
    jourCours
    dateDebut
    dateFin
    alternantCount
    createdAt
    updatedAt
  }
`

const LIST_SESSIONS = gql`
  query ListSessions($search: String) {
    sessions(search: $search) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

const GET_SESSION = gql`
  query GetSession($id: ID!) {
    session(id: $id) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

const CREATE_SESSION = gql`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

const UPDATE_SESSION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

const DELETE_SESSION = gql`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`

const SESSION_ALTERNANTS = gql`
  query SessionAlternants($sessionId: ID!) {
    sessionAlternants(sessionId: $sessionId) {
      id
      firstName
      lastName
      fullName
      session
      sessionId
      email
      phone
      company {
        name
      }
    }
  }
`

const ASSIGN_ALTERNANT = gql`
  mutation AssignAlternantToSession($sessionId: ID!, $alternantId: ID!) {
    assignAlternantToSession(sessionId: $sessionId, alternantId: $alternantId) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

const REMOVE_ALTERNANT = gql`
  mutation RemoveAlternantFromSession($sessionId: ID!, $alternantId: ID!) {
    removeAlternantFromSession(sessionId: $sessionId, alternantId: $alternantId) {
      ...SessionFields
    }
  }
  ${SESSION_FIELDS}
`

function unwrap<T>(res: { error?: { message: string }; data?: T }): T {
  if (res.error) throw new Error(res.error.message.replace(/^\[GraphQL\]\s*/, ''))
  return res.data as T
}

export async function fetchSessions(search?: string): Promise<Session[]> {
  const res = await pedaGraphqlClient.query(
    LIST_SESSIONS,
    { search: search?.trim() || undefined },
    { requestPolicy: 'network-only' },
  )
  return unwrap<{ sessions: Session[] }>(res).sessions
}

export async function fetchSession(id: string): Promise<Session | null> {
  const res = await pedaGraphqlClient.query(GET_SESSION, { id }, { requestPolicy: 'network-only' })
  return unwrap<{ session: Session | null }>(res).session
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const res = await pedaGraphqlClient.mutation(CREATE_SESSION, { input })
  return unwrap<{ createSession: Session }>(res).createSession
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session | null> {
  const res = await pedaGraphqlClient.mutation(UPDATE_SESSION, { id, input })
  return unwrap<{ updateSession: Session | null }>(res).updateSession
}

export async function deleteSession(id: string): Promise<boolean> {
  const res = await pedaGraphqlClient.mutation(DELETE_SESSION, { id })
  return unwrap<{ deleteSession: boolean }>(res).deleteSession
}

export async function fetchSessionAlternants(sessionId: string): Promise<Alternant[]> {
  const res = await pedaGraphqlClient.query(
    SESSION_ALTERNANTS,
    { sessionId },
    { requestPolicy: 'network-only' },
  )
  return unwrap<{ sessionAlternants: Alternant[] }>(res).sessionAlternants
}

export async function assignAlternantToSession(sessionId: string, alternantId: string): Promise<Session | null> {
  const res = await pedaGraphqlClient.mutation(ASSIGN_ALTERNANT, { sessionId, alternantId })
  return unwrap<{ assignAlternantToSession: Session | null }>(res).assignAlternantToSession
}

export async function removeAlternantFromSession(
  sessionId: string,
  alternantId: string,
): Promise<Session | null> {
  const res = await pedaGraphqlClient.mutation(REMOVE_ALTERNANT, { sessionId, alternantId })
  return unwrap<{ removeAlternantFromSession: Session | null }>(res).removeAlternantFromSession
}
