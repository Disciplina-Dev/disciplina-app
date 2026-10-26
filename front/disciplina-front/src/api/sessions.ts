import { gql } from 'urql'
import { pedaGraphqlClient } from '@/graphql/client'
import type { Alternant } from '@/types/alternant'
import type { Session } from '@/types/session'

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

export async function fetchSessionAlternants(sessionId: string): Promise<Alternant[]> {
  const res = await pedaGraphqlClient.query(
    SESSION_ALTERNANTS,
    { sessionId },
    { requestPolicy: 'network-only' },
  )
  return unwrap<{ sessionAlternants: Alternant[] }>(res).sessionAlternants
}
