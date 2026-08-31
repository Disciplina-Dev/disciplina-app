import { apiJson } from '@/api/httpClient'
import type { PageInfo } from '@/types/pagination'

export type ExternalAccessStatus =
  | 'SENDING'
  | 'PENDING'
  | 'AUTHENTICATED'
  | 'COMPLETED'
  | 'LOCKED'
  | 'EXPIRED'

export type ExternalAccessType = 'COMPANY' | 'CANDIDATE'

export interface ExternalReference {
  id: number
  name: string
}

export interface ExternalAccessRowData {
  signature: string
  code: string | null
  user_id: number
  external_id: string
  external_type: ExternalAccessType
  external_email: string | null
  external_first_name: string | null
  token: string | null
  reference_id: number
  reference_key: string
  status: ExternalAccessStatus
  attempts: number
  expires_at: string | null
  created_at?: string
  updated_at?: string
  creator_first_name: string
  creator_last_name: string
}

interface ExternalAccessEdge {
  node: ExternalAccessRowData
  cursor: string
}

export interface ExternalAccessConnection {
  edges: ExternalAccessEdge[]
  pageInfo: PageInfo
}

export interface ListExternalAccessParams {
  first?: number
  after?: string | null
  search?: string
  type?: ExternalAccessType
  status?: string
  userId?: number
}

export async function listExternalAccess(params: ListExternalAccessParams): Promise<ExternalAccessConnection> {
  const query = new URLSearchParams()
  if (params.first != null) query.set('first', String(params.first))
  if (params.after) query.set('after', params.after)
  if (params.search) query.set('search', params.search)
  if (params.type) query.set('type', params.type)
  if (params.status) query.set('status', params.status)
  if (params.userId != null) query.set('userId', String(params.userId))

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiJson<ExternalAccessConnection>(`/api/external${suffix}`)
}

export async function revokeExternalAccess(signature: string): Promise<void> {
  await apiJson<{ success: boolean }>(`/api/external/${signature}/revoke`, { method: 'POST' })
}

export async function regenerateExternalAccess(signature: string): Promise<void> {
  await apiJson<{ success: boolean }>(`/api/external/${signature}/regenerate`, { method: 'POST' })
}
