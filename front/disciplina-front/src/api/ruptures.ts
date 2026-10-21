import { gql } from 'urql'
import { pedaGraphqlClient } from '@/graphql/client'
import type { DeclareRuptureInput, Rupture, UpdateRuptureInput } from '@/types/rupture'

const RUPTURE_FIELDS = gql`
  fragment RuptureFields on Rupture {
    id
    alternantId
    firstName
    lastName
    fullName
    session
    sessionId
    dateRupture
    entreprise
    motif
    detail
    poursuitFormation
    createdAt
    updatedAt
  }
`

const LIST_RUPTURES = gql`
  query ListRuptures($year: Int!, $month: Int!) {
    ruptures(year: $year, month: $month) {
      ...RuptureFields
    }
  }
  ${RUPTURE_FIELDS}
`

const ALTERNANT_RUPTURES = gql`
  query AlternantRuptures($alternantId: ID!) {
    alternantRuptures(alternantId: $alternantId) {
      ...RuptureFields
    }
  }
  ${RUPTURE_FIELDS}
`

const DECLARE_RUPTURE = gql`
  mutation DeclareRupture($input: DeclareRuptureInput!) {
    declareRupture(input: $input) {
      ...RuptureFields
    }
  }
  ${RUPTURE_FIELDS}
`

const UPDATE_RUPTURE = gql`
  mutation UpdateRupture($id: ID!, $input: UpdateRuptureInput!) {
    updateRupture(id: $id, input: $input) {
      ...RuptureFields
    }
  }
  ${RUPTURE_FIELDS}
`

const DELETE_RUPTURE = gql`
  mutation DeleteRupture($id: ID!) {
    deleteRupture(id: $id)
  }
`

function unwrap<T>(res: { error?: { message: string }; data?: T }): T {
  if (res.error) throw new Error(res.error.message.replace(/^\[GraphQL\]\s*/, ''))
  return res.data as T
}

/** Rapport mensuel des ruptures (page Ruptures). */
export async function fetchRuptures(year: number, month: number): Promise<Rupture[]> {
  const res = await pedaGraphqlClient.query(LIST_RUPTURES, { year, month }, { requestPolicy: 'network-only' })
  return unwrap<{ ruptures: Rupture[] }>(res).ruptures
}

/** Ruptures déjà déclarées pour un alternant (fiche alternant). */
export async function fetchAlternantRuptures(alternantId: string): Promise<Rupture[]> {
  const res = await pedaGraphqlClient.query(ALTERNANT_RUPTURES, { alternantId }, { requestPolicy: 'network-only' })
  return unwrap<{ alternantRuptures: Rupture[] }>(res).alternantRuptures
}

export async function declareRupture(input: DeclareRuptureInput): Promise<Rupture> {
  const res = await pedaGraphqlClient.mutation(DECLARE_RUPTURE, { input })
  return unwrap<{ declareRupture: Rupture }>(res).declareRupture
}

export async function updateRupture(id: string, input: UpdateRuptureInput): Promise<Rupture | null> {
  const res = await pedaGraphqlClient.mutation(UPDATE_RUPTURE, { id, input })
  return unwrap<{ updateRupture: Rupture | null }>(res).updateRupture
}

export async function deleteRupture(id: string): Promise<boolean> {
  const res = await pedaGraphqlClient.mutation(DELETE_RUPTURE, { id })
  return unwrap<{ deleteRupture: boolean }>(res).deleteRupture
}
