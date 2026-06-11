import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Save, Mail, ImagePlus, Paperclip } from 'lucide-react'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useMailTemplatesStore, type MailTemplate, type MailTemplatesScope, type MailAttachment } from '@/store/mailTemplatesStore'

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors'

interface FormState {
  name: string
  subject: string
  body: string
  attachment: MailAttachment | null
}

const EMPTY_FORM: FormState = { name: '', subject: '', body: '', attachment: null }

// localStorage quota is ~5 MB for the whole store — keep template attachments small
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

export default function MailTemplates({ scope = 'rh' }: { scope?: MailTemplatesScope }) {
  const { templates, add, update, remove, signatureImage, setSignatureImage } = useMailTemplatesStore(scope)
  const [editing, setEditing] = useState<MailTemplate | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [sigSaved, setSigSaved] = useState(false)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
    setError(null)
  }

  function openEdit(t: MailTemplate) {
    setForm({ name: t.name, subject: t.subject, body: t.body, attachment: t.attachment ?? null })
    setEditing(t)
    setError(null)
  }

  function handleAttachmentFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Pièce jointe trop lourde (max 2 Mo pour un modèle).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setForm((f) => ({
        ...f,
        attachment: { filename: file.name, contentType: file.type || 'application/octet-stream', content: base64 },
      }))
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  function closeForm() {
    setEditing(null)
    setError(null)
  }

  function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('Tous les champs sont requis.')
      return
    }
    if (editing === 'new') {
      add(form)
    } else if (editing) {
      update(editing.id, form)
    }
    closeForm()
  }

  function handleSaveSignature(dataUrl: string) {
    setSignatureImage(dataUrl)
    setSigSaved(true)
    setTimeout(() => setSigSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-8">

      {/* ── Signature ───────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signature</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ajoutée automatiquement à chaque mail</p>
        </div>
        <SignatureEditor value={signatureImage} onSave={handleSaveSignature} saved={sigSaved} />
      </section>

      <div className="border-t border-gray-100" />

      {/* ── Modèles ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Modèles de mail</h2>
            <p className="text-sm text-gray-400 mt-0.5">Créez vos propres modèles réutilisables</p>
          </div>
          <Button size="sm" leftIcon={<Plus size={15} />} onClick={openNew}>
            Nouveau modèle
          </Button>
        </div>

        {/* Form */}
        {editing && (
          <div className="rounded-2xl border border-purple/20 bg-white p-6 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {editing === 'new' ? 'Nouveau modèle' : `Modifier · ${(editing as MailTemplate).name}`}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Nom du modèle</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex : Confirmation entretien DISCIPLINA"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Objet</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Objet du mail"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Corps du mail</label>
              <RichTextEditor
                value={form.body}
                onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                placeholder="Rédigez votre modèle ici..."
                minHeight="280px"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Pièce jointe (optionnelle)</label>
              {form.attachment ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-gray-100 px-4 py-2.5">
                  <Paperclip size={15} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{form.attachment.filename}</span>
                  <button
                    onClick={() => setForm((f) => ({ ...f, attachment: null }))}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-[10px] border border-dashed border-gray-200 px-4 py-2.5 text-sm text-gray-400 hover:border-blue hover:text-blue transition-colors">
                  <Paperclip size={15} />
                  Joindre un document au modèle (max 2 Mo)
                  <input type="file" className="hidden" onChange={(e) => handleAttachmentFile(e.target.files?.[0])} />
                </label>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeForm}>Annuler</Button>
              <Button size="sm" leftIcon={<Save size={15} />} onClick={handleSave}>
                Sauvegarder
              </Button>
            </div>
          </div>
        )}

        {/* Liste */}
        {templates.length === 0 && !editing ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Mail size={22} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Aucun modèle pour l'instant</p>
            <Button size="sm" variant="secondary" leftIcon={<Plus size={15} />} onClick={openNew}>
              Créer un modèle
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="group rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-2 hover:border-purple/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                    <p className="text-sm text-gray-400 truncate">{t.subject}</p>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(t)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p
                  className="text-xs text-gray-400 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: t.body }}
                />
                {t.attachment && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Paperclip size={12} />
                    {t.attachment.filename}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Signature sub-component ──────────────────────────────────────────────────

function SignatureEditor({
  value,
  onSave,
  saved,
}: {
  value: string
  onSave: (dataUrl: string) => void
  saved: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(value)

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-4">
      {preview ? (
        <div className="flex flex-col gap-3">
          <img src={preview} alt="Signature" className="max-h-24 max-w-xs object-contain" />
          <button
            onClick={() => { setPreview(''); onSave('') }}
            className="self-start text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Supprimer
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-gray-400 hover:border-blue hover:text-blue transition-colors">
          <ImagePlus size={22} />
          <span className="text-sm">Cliquer pour importer votre signature (PNG, JPG)</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      <div className="flex justify-end">
        <Button size="sm" leftIcon={<Save size={15} />} onClick={() => onSave(preview)}>
          {saved ? 'Sauvegardé !' : 'Sauvegarder la signature'}
        </Button>
      </div>
    </div>
  )
}
