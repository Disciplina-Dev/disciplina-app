import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, FileText, Mail, PenLine, Save, X } from 'lucide-react'
import { apiFetch } from '@/api/httpClient'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useCommercialMailTemplatesStore } from '@/store/mailTemplatesStore'
import { fetchCommercialSignature, saveCommercialSignature } from '@/api/mailTemplates'
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
  const { templates, load: loadTemplates } = useCommercialMailTemplatesStore()
  const [activeTab, setActiveTab] = useState<TabKey>('ab')
  const [pdfUrls, setPdfUrls] = useState<Record<TabKey, string | null>>({ ab: null, mandat: null, catalogue: null })
  const [email, setEmail] = useState<EmailData | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [baseSubject, setBaseSubject] = useState('')
  const [baseBody, setBaseBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)
  const [savedTpl, setSavedTpl] = useState(false)
  const [tplError, setTplError] = useState<string | null>(null)

  // Deuxième section : signature commerciale par-user, ajoutée à la fin du mail.
  const [commercialSignature, setCommercialSignature] = useState('')
  const [baseCommercialSignature, setBaseCommercialSignature] = useState('')
  const [savingSig, setSavingSig] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)
  const [sigError, setSigError] = useState<string | null>(null)
  const [sigLoading, setSigLoading] = useState(true)

  // Charge les 3 PDF (en blob, pour pouvoir les afficher inline malgré l'auth) + le mail.
  useEffect(() => {
    let cancelled = false
    const created: string[] = []

    async function fetchPdf(path: string): Promise<string> {
      const res = await apiFetch(path)
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
        const mailRes = await apiFetch(
          `/api/needs-analysis/signature/email?abId=${encodeURIComponent(abId)}`,
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
  }, [abId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Charge la signature commerciale du commercial connecté (persistée par user).
  useEffect(() => {
    let cancelled = false
    fetchCommercialSignature()
      .then((sig) => {
        if (cancelled) return
        setCommercialSignature(sig)
        setBaseCommercialSignature(sig)
      })
      .catch(() => {
        if (cancelled) return
        const fallback = '<p>Cordialement,</p><p>Commercial Disciplina<br>{{signature}}</p>'
        setCommercialSignature(fallback)
        setBaseCommercialSignature(fallback)
      })
      .finally(() => {
        if (!cancelled) setSigLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!email || selectedTemplateId) return
    const currentTemplate = email.templateId ? templates.find((t) => t.id === email.templateId) : templates[0]
    if (currentTemplate) {
      setSelectedTemplateId(currentTemplate.id)
      setSelectedTemplateName(currentTemplate.name)
      setSubject(currentTemplate.subject)
      setBody(currentTemplate.body)
      setBaseSubject(currentTemplate.subject)
      setBaseBody(currentTemplate.body)
      return
    }
    setSelectedTemplateId(email.templateId ?? '')
    setSelectedTemplateName(email.templateName ?? 'Analyse du Besoin à signer')
    setSubject(email.subject)
    setBody(email.body)
    setBaseSubject(email.subject)
    setBaseBody(email.body)
  }, [email, templates, selectedTemplateId])

  const currentTemplate = email?.templateId
    ? { id: email.templateId, name: email.templateName ?? 'Analyse du Besoin à signer', subject: email.subject, body: email.body }
    : null
  const availableTemplates = currentTemplate
    ? [currentTemplate, ...templates.filter((t) => t.id !== currentTemplate.id)]
    : templates

  function applyTemplate(template: { id: string; name: string; subject: string; body: string }) {
    setSelectedTemplateId(template.id)
    setSelectedTemplateName(template.name)
    setSubject(template.subject)
    setBody(template.body)
    setBaseSubject(template.subject)
    setBaseBody(template.body)
    setSavedTpl(false)
    setTplError(null)
    setShowPreview(false)
  }

  const handleConfirm = async () => {
    setSending(true)
    try {
      // Persiste la signature commerciale si elle a été modifiée, afin que
      // le back l'ajoute à la fin du mail lors de l'envoi.
      if (commercialSignature !== baseCommercialSignature) {
        try {
          await saveCommercialSignature(commercialSignature)
          setBaseCommercialSignature(commercialSignature)
        } catch {
          // Si la sauvegarde échoue, on envoie quand même le corps principal ;
          // le back utilisera l'ancienne signature stockée.
        }
      }
      await onConfirm({ subject, body })
    } finally {
      setSending(false)
    }
  }

  const handleSaveCommercialSignature = async () => {
    if (!commercialSignature.trim()) return
    setSavingSig(true)
    setSigError(null)
    try {
      const saved = await saveCommercialSignature(commercialSignature)
      setCommercialSignature(saved)
      setBaseCommercialSignature(saved)
      setSigSaved(true)
      setTimeout(() => setSigSaved(false), 2500)
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Échec de l\'enregistrement')
    } finally {
      setSavingSig(false)
    }
  }

  // Enregistre le mail édité dans le modèle commercial sélectionné.
  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return
    setSavingTpl(true)
    setTplError(null)
    try {
      const res = await apiFetch(`/api/mail-templates/${selectedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedTemplateName || 'Analyse du Besoin à signer', subject, body }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || `Échec de l'enregistrement (${res.status})`)
      }
      await loadTemplates(true)
      setBaseSubject(subject)
      setBaseBody(body)
      setSavedTpl(true)
      setTimeout(() => setSavedTpl(false), 2500)
    } catch (err) {
      setTplError(err instanceof Error ? err.message : 'Échec de l\'enregistrement')
    } finally {
      setSavingTpl(false)
    }
  }

  const activeUrl = pdfUrls[activeTab]
  const dirty = subject !== baseSubject || body !== baseBody
  const sigDirty = commercialSignature !== baseCommercialSignature

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

            {availableTemplates.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Modèle de mail</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const template = availableTemplates.find((t) => t.id === e.target.value)
                    if (template) applyTemplate(template)
                  }}
                  className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id === email?.templateId ? `${t.name} (par défaut)` : t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">
                  Le modèle actuel reste sélectionné par défaut. Les commerciaux peuvent choisir un autre modèle personnel.
                </p>
              </div>
            )}

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
            {selectedTemplateId && (
              <div className="mt-3 flex items-center gap-3 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={savingTpl || !dirty || !selectedTemplateId}
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

          {/* Signature commerciale — deuxième section ajoutée à la fin du mail */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <PenLine size={15} /> Signature du commercial
              <span className="ml-1 text-[11px] font-normal text-gray-400">— ajoutée à la fin du mail, enregistrée par commercial</span>
            </div>

            {sigLoading ? (
              <p className="text-xs text-gray-400">Chargement de votre signature…</p>
            ) : showPreview ? (
              <div
                className="prose prose-sm max-w-none rounded-[10px] border border-gray-200 bg-white p-4 text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: cleanHtml(renderPreview(commercialSignature, email?.variables ?? {})) }}
              />
            ) : (
              <RichTextEditor value={commercialSignature} onChange={setCommercialSignature} minHeight="120px" />
            )}

            <p className="mt-2 text-[11px] text-gray-400">
              Variable : <code className="rounded bg-gray-200/70 px-1">{'{{signature}}'}</code> — votre image de signature.
              Contenu par défaut : <code className="rounded bg-gray-200/70 px-1">Cordialement, Commercial Disciplina</code> + image.
              Cette signature est ajoutée automatiquement à la fin du mail à l'envoi.
            </p>

            <div className="mt-3 flex items-center gap-3 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={handleSaveCommercialSignature}
                disabled={savingSig || !sigDirty || sigLoading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-blue hover:text-blue disabled:opacity-40">
                {sigSaved ? <Check size={13} /> : <Save size={13} />}
                {sigSaved ? 'Signature enregistrée' : 'Enregistrer ma signature'}
              </button>
              <span className="text-[11px] text-gray-400">
                {sigDirty ? 'Modifications non enregistrées.' : 'Votre signature pour les prochains envois.'}
              </span>
              {sigError && <span className="text-[11px] text-danger">{sigError}</span>}
            </div>
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
