import { apiFetch } from '@/api/httpClient'

export type MailTemplatesScope = 'rh' | 'commercial' | 'peda'

/** Niveau de relance d'absence rattaché à un modèle du scope `peda`. */
export const PEDA_LEVELS = ['niv1', 'niv2', 'niv3', 'nivPlus'] as const
export type PedaLevel = (typeof PEDA_LEVELS)[number]

export const PEDA_LEVEL_LABELS: Record<PedaLevel, string> = {
  niv1: 'Niveau 1',
  niv2: 'Niveau 2',
  niv3: 'Niveau 3',
  nivPlus: 'Niveau +',
}

/** Colonnes « Mail niv » du Sheet qui déclenchent chaque niveau (aide à la saisie). */
export const PEDA_LEVEL_HINTS: Record<PedaLevel, string> = {
  niv1: 'absences 1 et 2',
  niv2: 'absences 3 et 4',
  niv3: 'absences 5, 6 et 7',
  nivPlus: 'absences 8, 9 et 10',
}

/** Données éditables d'un modèle (pedaLevel ignoré hors scope peda). */
export interface MailTemplateInput {
  name: string
  subject: string
  body: string
  pedaLevel?: PedaLevel | null
}

/** Métadonnées de PJ renvoyées par l'API (le contenu reste sur Drive). */
export interface MailTemplateAttachmentMeta {
  filename: string
  contentType: string
}

/** Modèle système (non supprimable, partagé) ; null pour un modèle utilisateur. */
export type MailTemplateKind =
  | 'ab_signature'
  | 'ab_relance'
  | 'proposition_candidat'
  | 'external_access'
  | 'external_link'
  | 'interview_invitation'

export interface MailTemplate {
  id: string
  name: string
  subject: string
  body: string
  pedaLevel: PedaLevel | null
  kind: MailTemplateKind | null
  attachment: MailTemplateAttachmentMeta | null
}

/** PJ résolue (contenu base64) prête à être attachée à un envoi. */
export interface ResolvedAttachment {
  filename: string
  contentType: string
  content: string // base64 (sans préfixe data URL)
}

async function tplFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/mail-templates${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Requête modèles échouée (${res.status})`)
  }
  return res
}

const jsonHeaders = { 'Content-Type': 'application/json' }

// ── Modèles ────────────────────────────────────────────────────────────────
export async function fetchTemplates(scope: MailTemplatesScope): Promise<MailTemplate[]> {
  const res = await tplFetch(`/?scope=${scope}`)
  return ((await res.json()) as { templates: MailTemplate[] }).templates
}

export async function createTemplate(scope: MailTemplatesScope, data: MailTemplateInput): Promise<MailTemplate> {
  const res = await tplFetch(`/?scope=${scope}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(data) })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function updateTemplate(id: string, data: MailTemplateInput): Promise<MailTemplate> {
  const res = await tplFetch(`/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(data) })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function deleteTemplate(id: string): Promise<void> {
  await tplFetch(`/${id}`, { method: 'DELETE' })
}

// ── Pièce jointe ─────────────────────────────────────────────────────────────
export async function uploadTemplateAttachment(id: string, file: File): Promise<MailTemplate> {
  const form = new FormData()
  form.append('file', file)
  const res = await tplFetch(`/${id}/attachment`, { method: 'POST', body: form })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function deleteTemplateAttachment(id: string): Promise<MailTemplate> {
  const res = await tplFetch(`/${id}/attachment`, { method: 'DELETE' })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function resolveTemplateAttachment(id: string): Promise<ResolvedAttachment> {
  const res = await tplFetch(`/${id}/attachment`)
  return ((await res.json()) as { attachment: ResolvedAttachment }).attachment
}

// ── Signature ────────────────────────────────────────────────────────────────
export async function fetchSignature(scope: MailTemplatesScope): Promise<string> {
  const res = await tplFetch(`/signature?scope=${scope}`)
  return ((await res.json()) as { signature: string | null }).signature ?? ''
}

export async function uploadSignature(scope: MailTemplatesScope, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await tplFetch(`/signature?scope=${scope}`, { method: 'PUT', body: form })
  return ((await res.json()) as { signature: string | null }).signature ?? ''
}

export async function deleteSignature(scope: MailTemplatesScope): Promise<void> {
  await tplFetch(`/signature?scope=${scope}`, { method: 'DELETE' })
}
