import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MailAttachment {
  filename: string
  contentType: string
  content: string   // base64 (no data URL prefix)
}

export interface MailTemplate {
  id: string
  name: string
  subject: string
  body: string
  attachment?: MailAttachment | null
}

export type MailTemplatesScope = 'rh' | 'commercial'

interface MailTemplatesStore {
  templates: MailTemplate[]
  signatureImage: string   // base64 data URL
  add: (t: Omit<MailTemplate, 'id'>) => void
  update: (id: string, t: Omit<MailTemplate, 'id'>) => void
  remove: (id: string) => void
  setSignatureImage: (dataUrl: string) => void
}

function createMailTemplatesStore(storageKey: string) {
  return create<MailTemplatesStore>()(
    persist(
      (set) => ({
        templates: [],
        signatureImage: '',
        add: (t) =>
          set((s) => ({
            templates: [...s.templates, { ...t, id: crypto.randomUUID() }],
          })),
        update: (id, t) =>
          set((s) => ({
            templates: s.templates.map((tmpl) => (tmpl.id === id ? { ...t, id } : tmpl)),
          })),
        remove: (id) =>
          set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
        setSignatureImage: (dataUrl) => set({ signatureImage: dataUrl }),
      }),
      { name: storageKey }
    )
  )
}

// RH keeps the historical storage key so existing templates are preserved
export const useRhMailTemplatesStore = createMailTemplatesStore('disciplina-mail-templates')
export const useCommercialMailTemplatesStore = createMailTemplatesStore('disciplina-mail-templates-commercial')

export function useMailTemplatesStore(scope: MailTemplatesScope) {
  // Both branches are stable per mount: `scope` never changes for a given page/modal
  return scope === 'commercial' ? useCommercialMailTemplatesStore() : useRhMailTemplatesStore()
}
