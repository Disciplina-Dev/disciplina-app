import { create } from 'zustand'
import { useAuthStore } from './authStore'
import * as api from '@/api/mailTemplates'

// Pièce jointe prête à l'envoi (contenu base64) — utilisée par MailModal.
export interface MailAttachment {
  filename: string
  contentType: string
  content: string // base64 (sans préfixe data URL)
}

export type MailTemplate = api.MailTemplate
export type MailTemplatesScope = api.MailTemplatesScope

interface MailTemplatesStore {
  scope: MailTemplatesScope
  templates: MailTemplate[]
  signatureImage: string // data URL résolue depuis Drive
  loading: boolean
  loaded: boolean
  error: string | null
  load: (force?: boolean) => Promise<void>
  add: (data: { name: string; subject: string; body: string }, file?: File | null) => Promise<void>
  update: (id: string, data: { name: string; subject: string; body: string }, file?: File | null, removeAttachment?: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  setSignature: (file: File) => Promise<void>
  removeSignature: () => Promise<void>
  resolveAttachment: (id: string) => Promise<MailAttachment>
}

function token(): string {
  const t = useAuthStore.getState().token
  if (!t) throw new Error('Non authentifié')
  return t
}

function createMailTemplatesStore(scope: MailTemplatesScope) {
  return create<MailTemplatesStore>()((set, get) => ({
    scope,
    templates: [],
    signatureImage: '',
    loading: false,
    loaded: false,
    error: null,

    load: async (force = false) => {
      if (get().loading || (get().loaded && !force)) return
      set({ loading: true, error: null })
      try {
        const [templates, signatureImage] = await Promise.all([
          api.fetchTemplates(token(), scope),
          api.fetchSignature(token(), scope).catch(() => ''), // signature optionnelle (Drive peut échouer)
        ])
        set({ templates, signatureImage, loaded: true })
      } catch (e: any) {
        set({ error: e.message ?? 'Erreur de chargement' })
      } finally {
        set({ loading: false })
      }
    },

    add: async (data, file) => {
      let tpl = await api.createTemplate(token(), scope, data)
      if (file) tpl = await api.uploadTemplateAttachment(token(), tpl.id, file)
      set((s) => ({ templates: [...s.templates, tpl] }))
    },

    update: async (id, data, file, removeAttachment) => {
      let tpl = await api.updateTemplate(token(), id, data)
      if (removeAttachment) tpl = await api.deleteTemplateAttachment(token(), id)
      if (file) tpl = await api.uploadTemplateAttachment(token(), id, file)
      set((s) => ({ templates: s.templates.map((t) => (t.id === id ? tpl : t)) }))
    },

    remove: async (id) => {
      await api.deleteTemplate(token(), id)
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    },

    setSignature: async (file) => {
      const signatureImage = await api.uploadSignature(token(), scope, file)
      set({ signatureImage })
    },

    removeSignature: async () => {
      await api.deleteSignature(token(), scope)
      set({ signatureImage: '' })
    },

    resolveAttachment: async (id) => api.resolveTemplateAttachment(token(), id),
  }))
}

export const useRhMailTemplatesStore = createMailTemplatesStore('rh')
export const useCommercialMailTemplatesStore = createMailTemplatesStore('commercial')

export function useMailTemplatesStore(scope: MailTemplatesScope) {
  // scope ne change jamais pour un même montage de page/modal → branche stable.
  return scope === 'commercial' ? useCommercialMailTemplatesStore() : useRhMailTemplatesStore()
}
