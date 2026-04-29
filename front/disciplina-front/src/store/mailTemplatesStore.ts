import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface MailTemplatesStore {
  templates: MailTemplate[]
  signatureImage: string   // base64 data URL
  add: (t: Omit<MailTemplate, 'id'>) => void
  update: (id: string, t: Omit<MailTemplate, 'id'>) => void
  remove: (id: string) => void
  setSignatureImage: (dataUrl: string) => void
}

export const useMailTemplatesStore = create<MailTemplatesStore>()(
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
    { name: 'disciplina-mail-templates' }
  )
)
