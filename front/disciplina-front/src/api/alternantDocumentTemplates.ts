import { gql } from 'urql'
import { pedaGraphqlClient } from '@/graphql/client'
import type {
  AlternantDocumentTemplate,
  AlternantDocumentTemplateInput,
  AlternantSequenceDocument,
  SaveAlternantSequenceDocumentInput,
} from '@/types/alternantDocumentTemplate'
import type { AlternantSequenceType } from '@/types/alternant'

const TEMPLATE_FIELDS = gql`
  fragment AlternantDocumentTemplateFields on AlternantDocumentTemplate {
    id
    type
    label
    maitreApprentissage
    alternant
    formateur
    createdAt
    updatedAt
  }
`

const LIST_TEMPLATES = gql`
  query ListAlternantDocumentTemplates($type: AlternantSequenceType) {
    alternantDocumentTemplates(type: $type) {
      ...AlternantDocumentTemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`

const CREATE_TEMPLATE = gql`
  mutation CreateAlternantDocumentTemplate($input: AlternantDocumentTemplateInput!) {
    createAlternantDocumentTemplate(input: $input) {
      ...AlternantDocumentTemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`

const UPDATE_TEMPLATE = gql`
  mutation UpdateAlternantDocumentTemplate($id: ID!, $input: AlternantDocumentTemplateInput!) {
    updateAlternantDocumentTemplate(id: $id, input: $input) {
      ...AlternantDocumentTemplateFields
    }
  }
  ${TEMPLATE_FIELDS}
`

const DELETE_TEMPLATE = gql`
  mutation DeleteAlternantDocumentTemplate($id: ID!) {
    deleteAlternantDocumentTemplate(id: $id)
  }
`

const SEQUENCE_DOCUMENT_FIELDS = gql`
  fragment AlternantSequenceDocumentFields on AlternantSequenceDocument {
    sequenceId
    header {
      alternantFullName
      session
      companyName
      mentorName
      companyStartDate
      companyEndDate
    }
    maitreApprentissage
    alternant
    formateur
    signatureMaitreApprentissage
    signatureAlternant
    signatureFormateur
    isSnapshotted
    template {
      maitreApprentissage
      alternant
      formateur
    }
  }
`

const GET_SEQUENCE_DOCUMENT = gql`
  query GetAlternantSequenceDocument($sequenceId: ID!) {
    alternantSequenceDocument(sequenceId: $sequenceId) {
      ...AlternantSequenceDocumentFields
    }
  }
  ${SEQUENCE_DOCUMENT_FIELDS}
`

const SAVE_SEQUENCE_DOCUMENT = gql`
  mutation SaveAlternantSequenceDocument($sequenceId: ID!, $input: SaveAlternantSequenceDocumentInput!) {
    saveAlternantSequenceDocument(sequenceId: $sequenceId, input: $input) {
      ...AlternantSequenceDocumentFields
    }
  }
  ${SEQUENCE_DOCUMENT_FIELDS}
`

function unwrap<T>(res: { error?: { message: string }; data?: T }): T {
  if (res.error) throw new Error(res.error.message.replace(/^\[GraphQL\]\s*/, ''))
  return res.data as T
}

export async function fetchAlternantDocumentTemplates(
  type?: AlternantSequenceType,
): Promise<AlternantDocumentTemplate[]> {
  const res = await pedaGraphqlClient.query(LIST_TEMPLATES, { type }, { requestPolicy: 'network-only' })
  return unwrap<{ alternantDocumentTemplates: AlternantDocumentTemplate[] }>(res).alternantDocumentTemplates
}

/** Raccourci pour le menu déroulant de `SessionFormModal` : seuls les modèles périodiques sont assignables à une Session. */
export function fetchPeriodicTemplates(): Promise<AlternantDocumentTemplate[]> {
  return fetchAlternantDocumentTemplates('periodique')
}

export async function createAlternantDocumentTemplate(
  input: AlternantDocumentTemplateInput,
): Promise<AlternantDocumentTemplate> {
  const res = await pedaGraphqlClient.mutation(CREATE_TEMPLATE, { input })
  return unwrap<{ createAlternantDocumentTemplate: AlternantDocumentTemplate }>(res)
    .createAlternantDocumentTemplate
}

export async function updateAlternantDocumentTemplate(
  id: string,
  input: AlternantDocumentTemplateInput,
): Promise<AlternantDocumentTemplate> {
  const res = await pedaGraphqlClient.mutation(UPDATE_TEMPLATE, { id, input })
  return unwrap<{ updateAlternantDocumentTemplate: AlternantDocumentTemplate }>(res)
    .updateAlternantDocumentTemplate
}

export async function deleteAlternantDocumentTemplate(id: string): Promise<boolean> {
  const res = await pedaGraphqlClient.mutation(DELETE_TEMPLATE, { id })
  return unwrap<{ deleteAlternantDocumentTemplate: boolean }>(res).deleteAlternantDocumentTemplate
}

export async function fetchSequenceDocument(sequenceId: string): Promise<AlternantSequenceDocument> {
  const res = await pedaGraphqlClient.query(
    GET_SEQUENCE_DOCUMENT,
    { sequenceId },
    { requestPolicy: 'network-only' },
  )
  return unwrap<{ alternantSequenceDocument: AlternantSequenceDocument }>(res).alternantSequenceDocument
}

export async function saveSequenceDocument(
  sequenceId: string,
  input: SaveAlternantSequenceDocumentInput,
): Promise<AlternantSequenceDocument> {
  const res = await pedaGraphqlClient.mutation(SAVE_SEQUENCE_DOCUMENT, { sequenceId, input })
  return unwrap<{ saveAlternantSequenceDocument: AlternantSequenceDocument }>(res)
    .saveAlternantSequenceDocument
}
