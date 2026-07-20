import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, FileText, Mail, PenLine, Save, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { cleanHtml } from '@/services/sanitizeHtml'

// Aperçu avant l'envoi en signature : le commercial vérifie les documents
// (Analyse du Besoin + Mandat à signer + Catalogue à consulter) et peut MODIFIER
// le mail qui partira (objet + corps). Le mail est envoyé depuis son Gmail avec le
// lien de signature DocuSeal. Il peut aussi enregistrer ses changements comme
// modèle (« Modèles mail »). Annuler laisse l'AB en BROUILLON.

interface Props {
  abId: string
  onConfirm: (email: { subject: string; body: string }) => Promise<void> | void
  onCancel: () => void
}

type TabKey = 'ab' | 'mandat' | 'catalogue'

const TABS: { key: TabKey; label: string; path: (id: string) => string }[] = [
  { key: 'ab', label: 'Analyse du Besoin', path: (id) => `/api/needs-analysis/${id}/pdf` },
  { key: 'mandat', label: 'Mandat', path: () => `/api/needs-analysis/signature/mandat-pdf` },
  { key: 'catalogue', label: 'Catalogue', path: () => `/api/needs-analysis/signature/catalogue-pdf` },
]

interface EmailData {
  templateId: string | null
  templateName: string | null
  subject: string
  body: string
  variables: Record<string, string>
}

/** Rendu « aperçu » : remplace les variables par des valeurs lisibles (sans exécuter le HTML). */
function renderPreview(body: string, vars: Record<string, string>): string {
  const button =
    '<span style="display:inline-block;background:#2563eb;color:#fff;padding:8px 16px;' +
    'border-radius:8px;font-weight:600">Signer les documents</span>'
  return body
    .replaceAll('{{entreprise}}', vars.entreprise || 'votre entreprise')
    .replaceAll('{{lien_signature}}', button)
    .replaceAll('{{signature}}', '<em style="color:#888">[ votre signature mail ]</em>')
}

export default function SignaturePreviewModal({ abId, onConfirm, onCancel }: Props) {
  const token = useAuthStore((s) => s.token)
  const [activeTab, setActiveTab] = useState<TabKey>('ab')
  const [pdfUrls, setPdfUrls] = useState<Record<TabKey, string | null>>({ ab: null, mandat: null, catalogue: null })
  const [email, setEmail] = useState<EmailData | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)
  const [savedTpl, setSavedTpl] = useState(false)
  const [tplError, setTplError] = useState<string | null>(null)

  // Charge les 3 PDF (en blob, pour pouvoir les afficher inline malgré l'auth) + le mail.
  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    async function fetchPdf(path: string): Promise<string> {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers })
      if (!res.ok) throw new Error(`Chargement du document échoué (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      created.push(url)
      return url
    }

    ;(async () => {
      try {
        const [ab, mandat, catalogue] = await Promise.all([
          fetchPdf(`/api/needs-analysis/${abId}/pdf`),
          fetchPdf(`/api/needs-analysis/signature/mandat-pdf`),
          fetchPdf(`/api/needs-analysis/signature/catalogue-pdf`),
        ])
        const mailRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/needs-analysis/signature/email?abId=${encodeURIComponent(abId)}`,
          { headers },
        )
        const mail: EmailData = mailRes.ok
          ? await mailRes.json()
          : { templateId: null, templateName: null, subject: '', body: '', variables: {} }
        if (cancelled) return
        setPdfUrls({ ab, mandat, catalogue })
        setEmail(mail)
        setSubject(mail.subject)
        setBody(mail.body)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erreur de chargement')
      }
    })()

    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [abId, token])

  const handleConfirm = async () => {
    setSending(true)
    try {
      await onConfirm({ subject, body })
    } finally {
      setSending(false)
    }
  }

  // Enregistre le mail édité comme modèle système « AB à signer ».
  const handleSaveTemplate = async () => {
    if (!email?.templateId) return
    setSavingTpl(true)
    setTplError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/mail-templates/${email.templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: email.templateName ?? 'Analyse du Besoin à signer', subject, body }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || `Échec de l'enregistrement (${res.status})`)
      }
      setSavedTpl(true)
      setTimeout(() => setSavedTpl(false), 2500)
    } catch (err) {
      setTplError(err instanceof Error ? err.message : 'Échec de l\'enregistrement')
    } finally {
      setSavingTpl(false)
    }
  }

  const activeUrl = pdfUrls[activeTab]
  const dirty = !!email && (subject !== email.subject || body !== email.body)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Aperçu avant envoi en signature</h2>
          <button onClick={onCancel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 px-6 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-blue-50 text-blue' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <FileText size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body : PDF + mail */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
          {loadError ? (
            <p className="rounded-lg border border-danger-bg bg-danger-bg px-4 py-2.5 text-sm text-danger">{loadError}</p>
          ) : (
            <div className="min-h-[38vh] flex-1 overflow-hidden rounded-lg border border-gray-200">
              {activeUrl ? (
                <iframe title={activeTab} src={activeUrl} className="h-full min-h-[38vh] w-full" />
              ) : (
                <div className="flex h-full min-h-[38vh] items-center justify-center text-sm text-gray-400">
                  Chargement du document…
                </div>
              )}
            </div>
          )}

          {/* Mail éditable envoyé au responsable recrutement */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Mail size={15} /> Mail envoyé au responsable recrutement
              </div>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs font-medium text-blue hover:underline">
                {showPreview ? 'Éditer' : 'Aperçu rendu'}
              </button>
            </div>

            {/* Objet */}
            <label className="mb-1 block text-xs font-medium text-gray-500">Objet</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={showPreview}
              className="mb-3 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue disabled:bg-gray-100"
            />

            {/* Corps : édition ou aperçu rendu */}
            <label className="mb-1 block text-xs font-medium text-gray-500">Corps du mail</label>
            {showPreview ? (
              <div
                className="prose prose-sm max-w-none rounded-[10px] border border-gray-200 bg-white p-4 text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: cleanHtml(renderPreview(body, email?.variables ?? {})) }}
              />
            ) : (
              <RichTextEditor value={body} onChange={setBody} minHeight="200px" />
            )}

            {/* Variables */}
            <p className="mt-2 text-[11px] text-gray-400">
              Variables : <code className="rounded bg-gray-200/70 px-1">{'{{entreprise}}'}</code>{' '}
              <code className="rounded bg-gray-200/70 px-1">{'{{lien_signature}}'}</code>{' '}
              <code className="rounded bg-gray-200/70 px-1">{'{{signature}}'}</code> — remplacées à l'envoi. Le lien de
              signature est ajouté automatiquement s'il manque.
            </p>

            {/* Enregistrer comme modèle */}
            {email?.templateId && (
              <div className="mt-3 flex items-center gap-3 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={savingTpl || !dirty}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-blue hover:text-blue disabled:opacity-40">
                  {savedTpl ? <Check size={13} /> : <Save size={13} />}
                  {savedTpl ? 'Modèle enregistré' : 'Enregistrer comme modèle'}
                </button>
                <span className="text-[11px] text-gray-400">
                  {dirty ? 'Met à jour le modèle pour les prochains envois.' : 'Aucune modification à enregistrer.'}
                </span>
                {tplError && <span className="text-[11px] text-danger">{tplError}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" onClick={onCancel} disabled={sending}>
            Annuler (garder en brouillon)
          </Button>
          <Button isLoading={sending} leftIcon={<PenLine size={16} />} onClick={handleConfirm}>
            Confirmer l'envoi en signature
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
