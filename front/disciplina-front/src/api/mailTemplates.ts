const API_BASE = import.meta.env.VITE_API_URL

export type MailTemplatesScope = 'rh' | 'commercial'

/** Métadonnées de PJ renvoyées par l'API (le contenu reste sur Drive). */
export interface MailTemplateAttachmentMeta {
  filename: string
  contentType: string
}

export interface MailTemplate {
  id: string
  name: string
  subject: string
  body: string
  attachment: MailTemplateAttachmentMeta | null
}

/** PJ résolue (contenu base64) prête à être attachée à un envoi. */
export interface ResolvedAttachment {
  filename: string
  contentType: string
  content: string // base64 (sans préfixe data URL)
}

async function tplFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/mail-templates${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Requête modèles échouée (${res.status})`)
  }
  return res
}

const jsonHeaders = { 'Content-Type': 'application/json' }

// ── Modèles ────────────────────────────────────────────────────────────────
export async function fetchTemplates(token: string, scope: MailTemplatesScope): Promise<MailTemplate[]> {
  const res = await tplFetch(`/?scope=${scope}`, token)
  return ((await res.json()) as { templates: MailTemplate[] }).templates
}

export async function createTemplate(token: string, scope: MailTemplatesScope, data: { name: string; subject: string; body: string }): Promise<MailTemplate> {
  const res = await tplFetch(`/?scope=${scope}`, token, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(data) })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function updateTemplate(token: string, id: string, data: { name: string; subject: string; body: string }): Promise<MailTemplate> {
  const res = await tplFetch(`/${id}`, token, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(data) })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function deleteTemplate(token: string, id: string): Promise<void> {
  await tplFetch(`/${id}`, token, { method: 'DELETE' })
}

// ── Pièce jointe ─────────────────────────────────────────────────────────────
export async function uploadTemplateAttachment(token: string, id: string, file: File): Promise<MailTemplate> {
  const form = new FormData()
  form.append('file', file)
  const res = await tplFetch(`/${id}/attachment`, token, { method: 'POST', body: form })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function deleteTemplateAttachment(token: string, id: string): Promise<MailTemplate> {
  const res = await tplFetch(`/${id}/attachment`, token, { method: 'DELETE' })
  return ((await res.json()) as { template: MailTemplate }).template
}

export async function resolveTemplateAttachment(token: string, id: string): Promise<ResolvedAttachment> {
  const res = await tplFetch(`/${id}/attachment`, token)
  return ((await res.json()) as { attachment: ResolvedAttachment }).attachment
}

// ── Signature ────────────────────────────────────────────────────────────────
export async function fetchSignature(token: string, scope: MailTemplatesScope): Promise<string> {
  const res = await tplFetch(`/signature?scope=${scope}`, token)
  return ((await res.json()) as { signature: string | null }).signature ?? ''
}

export async function uploadSignature(token: string, scope: MailTemplatesScope, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await tplFetch(`/signature?scope=${scope}`, token, { method: 'PUT', body: form })
  return ((await res.json()) as { signature: string | null }).signature ?? ''
}

export async function deleteSignature(token: string, scope: MailTemplatesScope): Promise<void> {
  await tplFetch(`/signature?scope=${scope}`, token, { method: 'DELETE' })
}
