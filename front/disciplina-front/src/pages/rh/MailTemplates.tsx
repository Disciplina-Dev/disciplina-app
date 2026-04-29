import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Save, Mail, ImagePlus } from 'lucide-react'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useMailTemplatesStore, type MailTemplate } from '@/store/mailTemplatesStore'

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors'

interface FormState {
  name: string
  subject: string
  body: string
}

const EMPTY_FORM: FormState = { name: '', subject: '', body: '' }

export default function MailTemplates() {
  const { templates, add, update, remove, signatureImage, setSignatureImage } = useMailTemplatesStore()
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
    setForm({ name: t.name, subject: t.subject, body: t.body })
    setEditing(t)
    setError(null)
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
