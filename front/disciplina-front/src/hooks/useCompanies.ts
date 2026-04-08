import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, relancesApi } from '@/services/companies'

// ── Query keys ────────────────────────────────────────────────
export const QK = {
  companies: (p?: object) => ['companies', p ?? {}] as const,
  company:   (id: string | number) => ['company', String(id)] as const,
  relances:  (p?: object) => ['relances', p ?? {}] as const,
}

// ── Hooks lecture ─────────────────────────────────────────────
export function useCompanies(params?: { statut?: string; search?: string }) {
  return useQuery({
    queryKey: QK.companies(params),
    queryFn:  () => companiesApi.list(params),
  })
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: QK.company(id!),
    queryFn:  () => companiesApi.get(id!),
    enabled:  !!id,
  })
}

export function useRelances(params?: { commercial_id?: number }) {
  return useQuery({
    queryKey: QK.relances(params),
    queryFn:  () => relancesApi.list(params),
  })
}

// ── Mutations ─────────────────────────────────────────────────
export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: companiesApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useLogCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; result: string; notes?: string; commercial_id?: number }) =>
      companiesApi.logCall(id, body),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.company(id) })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['relances'] })
    },
  })
}

export function useCreateRelance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; scheduled_date: string; notes?: string; commercial_id?: number }) =>
      companiesApi.createRelance(id, body),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.company(id) })
      qc.invalidateQueries({ queryKey: ['relances'] })
    },
  })
}

export function useUpdateRelance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; statut?: string }) =>
      relancesApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relances'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
