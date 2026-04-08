import { apiFetch } from './api'
import type {
  Entreprise, EntrepriseDetail, CallLog, Relance,
  CreateEntrepriseBody,
} from '@/types/api'

type ListParams = { statut?: string; search?: string; commercial_id?: number }
type ListResponse<T> = { data: T[]; total: number }

function toQS(params?: Record<string, unknown>) {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (!entries.length) return ''
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

// ── Entreprises ───────────────────────────────────────────────
export const companiesApi = {
  list: (params?: ListParams) =>
    apiFetch<ListResponse<Entreprise>>(`/api/companies${toQS(params)}`),

  get: (id: string | number) =>
    apiFetch<{ data: EntrepriseDetail }>(`/api/companies/${id}`),

  create: (body: CreateEntrepriseBody) =>
    apiFetch<{ data: Entreprise }>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string | number, body: Partial<Entreprise> & { statut?: string }) =>
    apiFetch<{ data: Entreprise }>(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ── Appels ─────────────────────────────────────────────────
  logCall: (
    id: string | number,
    body: { result: string; notes?: string; commercial_id?: number },
  ) =>
    apiFetch<{ data: CallLog }>(`/api/companies/${id}/calls`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getCalls: (id: string | number) =>
    apiFetch<{ data: CallLog[] }>(`/api/companies/${id}/calls`),

  // ── Relances ────────────────────────────────────────────────
  getRelances: (id: string | number) =>
    apiFetch<{ data: Relance[] }>(`/api/companies/${id}/relances`),

  createRelance: (
    id: string | number,
    body: { scheduled_date: string; notes?: string; commercial_id?: number },
  ) =>
    apiFetch<{ data: Relance }>(`/api/companies/${id}/relances`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

// ── Relances globales ─────────────────────────────────────────
export const relancesApi = {
  list: (params?: { commercial_id?: number; statut?: string }) =>
    apiFetch<ListResponse<Relance>>(`/api/relances${toQS(params)}`),

  update: (id: number, body: { statut?: string; scheduled_date?: string; notes?: string }) =>
    apiFetch<{ data: Relance }>(`/api/relances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}
