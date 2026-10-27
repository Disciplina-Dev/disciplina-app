import { gql } from 'urql'
import { pedaGraphqlClient } from '@/graphql/client'
import type { Alternant } from '@/types/alternant'
import type { CreateSessionInput, Session, SessionDegree } from '@/types/session'

const SESSION_FIELDS = gql`
  fragment SessionFields on Session {
    id
    nom
    filiere
    jourCours
    dateDebut
    dateFin
    headTeacher {
      firstName
      lastName
      mailAddress
    }
    referentTeacher {
      firstName
      lastName
      mailAddress
    }
    realizationAddress {
      housenumber
      street
      complement
      city
      postcode
      country
      formatted
    }
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

const RENAME_SESSION = gql`
  mutation RenameSession($id: ID!, $nom: String!) {
    renameSession(id: $id, nom: $nom) {
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

const SYNC_SESSION_REFERENCE = gql`
  mutation SyncSessionReference {
    syncSessionReference {
      degrees
      classes
    }
  }
`

const SESSION_DEGREES = gql`
  query SessionDegrees {
    sessionDegrees {
      id
      title
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

export async function renameSession(id: string, nom: string): Promise<Session | null> {
  const res = await pedaGraphqlClient.mutation(RENAME_SESSION, { id, nom })
  return unwrap<{ renameSession: Session | null }>(res).renameSession
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const res = await pedaGraphqlClient.mutation(CREATE_SESSION, { input })
  return unwrap<{ createSession: Session }>(res).createSession
}

export async function fetchSessionDegrees(): Promise<SessionDegree[]> {
  const res = await pedaGraphqlClient.query(SESSION_DEGREES, {}, { requestPolicy: 'network-only' })
  return unwrap<{ sessionDegrees: SessionDegree[] }>(res).sessionDegrees
}

export async function syncSessionReference(): Promise<{ degrees: number; classes: number }> {
  const res = await pedaGraphqlClient.mutation(SYNC_SESSION_REFERENCE, {})
  return unwrap<{ syncSessionReference: { degrees: number; classes: number } }>(res).syncSessionReference
}
