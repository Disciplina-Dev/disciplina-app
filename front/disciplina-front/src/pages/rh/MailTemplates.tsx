import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Save, Mail, ImagePlus, Paperclip, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useMailTemplatesStore, type MailTemplate, type MailTemplatesScope } from '@/store/mailTemplatesStore'

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors'

interface FormState {
  name: string
  subject: string
  body: string
  // PJ déjà stockée sur Drive (métadonnées) ; null si aucune ou supprimée.
  existingAttachment: { filename: string; contentType: string } | null
  // Nouveau fichier à uploader (remplace l'existant) ; null sinon.
  newFile: File | null
  removeExisting: boolean
}

const EMPTY_FORM: FormState = { name: '', subject: '', body: '', existingAttachment: null, newFile: null, removeExisting: false }

// Le fichier est zippé côté serveur puis stocké sur Drive — on tolère des PJ plus lourdes que l'ancien localStorage.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

// Variables remplacées à l'envoi du mail de confirmation (cf. back/src/rest/booking/service.ts).
const TEMPLATE_VARS: { token: string; label: string; example: string; date?: boolean }[] = [
  { token: 'nom', label: 'Nom de l’invité', example: 'Marie Dupont' },
  { token: 'date', label: 'Date et heure complètes', example: 'lundi 22 juin 2026 à 14:30 (Indian/Reunion)', date: true },
  { token: 'jour', label: 'Jour de la semaine', example: 'lundi', date: true },
  { token: 'date_longue', label: 'Date en toutes lettres (sans heure)', example: 'lundi 22 juin 2026', date: true },
  { token: 'date_courte', label: 'Date numérique', example: '22/06/2026', date: true },
  { token: 'heure', label: 'Heure seule', example: '14:30', date: true },
  { token: 'lieu', label: 'Lieu du rendez-vous', example: 'Visio' },
  { token: 'titre', label: 'Titre du rendez-vous', example: 'Entretien DISCIPLINA' },
  { token: 'duree', label: 'Durée', example: '30 minutes' },
  { token: 'hote', label: 'Nom de l’hôte', example: 'Jean Martin' },
]

export default function MailTemplates({ scope = 'rh' }: { scope?: MailTemplatesScope }) {
  const { templates, signatureImage, loading, loaded, error: storeError, load, add, update, remove, setSignature, removeSignature } =
    useMailTemplatesStore(scope)
  const [editing, setEditing] = useState<MailTemplate | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => { load() }, [load])

  function copyToken(token: string) {
    navigator.clipboard?.writeText(`{{${token}}}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken((c) => (c === token ? null : c)), 1500)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
    setError(null)
  }

  function openEdit(t: MailTemplate) {
    setForm({ name: t.name, subject: t.subject, body: t.body, existingAttachment: t.attachment, newFile: null, removeExisting: false })
    setEditing(t)
    setError(null)
  }

  function handleAttachmentFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Pièce jointe trop lourde (max 10 Mo).')
      return
    }
    setForm((f) => ({ ...f, newFile: file, removeExisting: false }))
    setError(null)
  }

  function clearAttachment() {
    setForm((f) => ({ ...f, newFile: null, existingAttachment: null, removeExisting: true }))
  }

  function closeForm() {
    setEditing(null)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('Tous les champs sont requis.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data = { name: form.name, subject: form.subject, body: form.body }
      if (editing === 'new') {
        await add(data, form.newFile)
      } else if (editing) {
        await update(editing.id, data, form.newFile, form.removeExisting && !form.newFile)
      }
      closeForm()
    } catch (e: any) {
      setError(e.message ?? 'Échec de l’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSignature(file: File) {
    setError(null)
    try {
      await setSignature(file)
      setSigSaved(true)
      setTimeout(() => setSigSaved(false), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Échec de l’enregistrement de la signature.')
    }
  }

  const attachmentLabel = form.newFile?.name ?? form.existingAttachment?.filename ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-8">

      {/* ── Signature ───────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signature</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ajoutée automatiquement à chaque mail · stockée sur votre Drive</p>
        </div>
        <SignatureEditor value={signatureImage} onSave={handleSaveSignature} onRemove={removeSignature} saved={sigSaved} />
      </section>

      <div className="border-t border-gray-100" />

      {/* ── Modèles ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Modèles de mail</h2>
            <p className="text-sm text-gray-400 mt-0.5">Créez vos propres modèles réutilisables · enregistrés sur le serveur</p>
          </div>
          <Button size="sm" leftIcon={<Plus size={15} />} onClick={openNew}>
            Nouveau modèle
          </Button>
        </div>

        {storeError && <p className="text-xs text-red-500">{storeError}</p>}

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

            {/* Variables disponibles */}
            <div className="rounded-[10px] border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-xs font-semibold text-gray-700">Variables disponibles</p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Insérez-les dans l’objet ou le corps : elles seront remplacées à l’envoi. Cliquez pour copier.
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {TEMPLATE_VARS.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => copyToken(v.token)}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-white ${v.date ? 'ring-1 ring-purple/15' : ''}`}
                    title="Copier"
                  >
                    <code className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${v.date ? 'bg-purple/10 text-purple' : 'bg-gray-200/70 text-gray-600'}`}>
                      {`{{${v.token}}}`}
                    </code>
                    <span className="text-[11px] text-gray-500">{v.label}</span>
                    <span className="ml-auto truncate text-[11px] italic text-gray-300 group-hover:text-gray-400">
                      {copiedToken === v.token ? 'Copié !' : `ex : ${v.example}`}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                <span className="inline-block h-2 w-2 rounded-full bg-purple/40 align-middle" /> Paramètres de date pour personnaliser finement.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Pièce jointe (optionnelle)</label>
              {attachmentLabel ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-gray-100 px-4 py-2.5">
                  <Paperclip size={15} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{attachmentLabel}</span>
                  {form.newFile && <span className="text-[11px] text-purple shrink-0">nouveau</span>}
                  <button onClick={clearAttachment} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-[10px] border border-dashed border-gray-200 px-4 py-2.5 text-sm text-gray-400 hover:border-blue hover:text-blue transition-colors">
                  <Paperclip size={15} />
                  Joindre un document au modèle (max 10 Mo)
                  <input type="file" className="hidden" onChange={(e) => handleAttachmentFile(e.target.files?.[0])} />
                </label>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeForm} disabled={saving}>Annuler</Button>
              <Button size="sm" leftIcon={<Save size={15} />} isLoading={saving} onClick={handleSave}>
                Sauvegarder
              </Button>
            </div>
          </div>
        )}

        {/* Liste */}
        {loading && templates.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-purple" /></div>
        ) : templates.length === 0 && !editing ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Mail size={22} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">{loaded ? "Aucun modèle pour l'instant" : 'Chargement…'}</p>
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
  onRemove,
  saved,
}: {
  value: string
  onSave: (file: File) => void
  onRemove: () => void
  saved: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(value)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => { setPreview(value); setFile(null) }, [value])

  function handleFile(f: File | undefined) {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col gap-4">
      {preview ? (
        <div className="flex flex-col gap-3">
          <img src={preview} alt="Signature" className="w-full max-w-[480px] h-auto object-contain" />
          <button
            onClick={() => { setPreview(''); setFile(null); onRemove() }}
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
        <Button size="sm" leftIcon={<Save size={15} />} disabled={!file} onClick={() => file && onSave(file)}>
          {saved ? 'Sauvegardé !' : 'Sauvegarder la signature'}
        </Button>
      </div>
    </div>
  )
}
