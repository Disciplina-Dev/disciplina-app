import { useState } from 'react'
import { X, Send, Paperclip, Trash2 } from 'lucide-react'
import Button from './Button'
import RichTextEditor from './RichTextEditor'
import { useMailTemplatesStore, type MailTemplatesScope, type MailAttachment } from '@/store/mailTemplatesStore'
import { useAuthStore } from '@/store/authStore'

interface MailModalProps {
  defaultTo?: string
  candidateName?: string
  scope?: MailTemplatesScope
  /** 'send' envoie directement, 'draft' crée un brouillon Gmail */
  mode?: 'send' | 'draft'
  /** Modèle appliqué à l'ouverture (objet, corps, pièce jointe) */
  defaultTemplateId?: string
  defaultSubject?: string
  defaultBody?: string
  onClose: () => void
  onSent?: () => void
}

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-blue transition-colors'

export default function MailModal({ defaultTo = '', candidateName, scope = 'rh', mode = 'send', defaultTemplateId, defaultSubject, defaultBody, onClose, onSent }: MailModalProps) {
  const { templates, signatureImage } = useMailTemplatesStore(scope)
  const token = useAuthStore((s) => s.token)

  const sigHtml = signatureImage
    ? `<br/><img src="${signatureImage}" alt="signature" style="max-height:96px;max-width:320px"/>`
    : ''

  const defaultTemplate = defaultTemplateId ? templates.find((t) => t.id === defaultTemplateId) : undefined

  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject ?? defaultTemplate?.subject ?? '')
  const [body, setBody] = useState(defaultBody ?? (defaultTemplate ? `${defaultTemplate.body}${sigHtml}` : sigHtml))
  const [attachment, setAttachment] = useState<MailAttachment | null>(defaultTemplate?.attachment ?? null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function applyTemplate(id: string) {
    if (!id) return
    const t = templates.find((t) => t.id === id)
    if (!t) return
    setSubject(t.subject)
    setBody(`${t.body}${sigHtml}`)
    if (t.attachment) setAttachment(t.attachment)
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setAttachment({ filename: file.name, contentType: file.type || 'application/octet-stream', content: base64 })
    }
    reader.readAsDataURL(file)
  }

  async function handleSend() {
    if (!to || !subject || !body) {
      setError('Veuillez remplir tous les champs.')
      return
    }
    setSending(true)
    setError(null)

    try {
      const endpoint = mode === 'draft' ? '/api/email/draft' : '/api/email/send'
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ to, subject, body, attachment: attachment ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur envoi')
      setSent(true)
      onSent?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-xl flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {candidateName ? `Mail à ${candidateName}` : 'Nouveau message'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Send size={22} className="text-green-600" />
            </div>
            <p className="font-medium text-gray-900">
              {mode === 'draft' ? 'Brouillon créé dans Gmail' : 'Mail envoyé avec succès'}
            </p>
            <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
          </div>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-4 px-6 py-5">

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">À</label>
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)}
                placeholder="destinataire@email.com" className={inputClass} />
            </div>

            {templates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Utiliser un modèle</label>
                <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)} className={inputClass}>
                  <option value="">— Choisir un modèle —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Objet</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet du mail" className={inputClass} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Message</label>
              <RichTextEditor value={body} onChange={setBody} minHeight="240px" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Pièce jointe</label>
              {attachment ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-gray-100 px-4 py-2.5">
                  <Paperclip size={15} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{attachment.filename}</span>
                  <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-[10px] border border-dashed border-gray-200 px-4 py-2.5 text-sm text-gray-400 hover:border-blue hover:text-blue transition-colors">
                  <Paperclip size={15} />
                  Joindre un document
                  <input type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                </label>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1 pb-1">
              <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
              <Button size="sm" leftIcon={<Send size={15} />} isLoading={sending} onClick={handleSend}>
                {mode === 'draft' ? 'Créer le brouillon' : 'Envoyer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
