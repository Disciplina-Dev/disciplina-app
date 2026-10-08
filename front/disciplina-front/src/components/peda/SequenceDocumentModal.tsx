import { useEffect, useState } from 'react'
import { IconClose, IconDownload, IconFile, IconLoader, IconRefresh, IconSave } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SignaturePad from '@/components/ui/SignaturePad'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { apiFetch } from '@/api/httpClient'
import { fetchAlternantDocumentTemplates, fetchSequenceDocument, saveSequenceDocument } from '@/api/alternantDocumentTemplates'
import type { AlternantDocumentTemplate, AlternantSequenceDocument } from '@/types/alternantDocumentTemplate'

type Part = 'maitreApprentissage' | 'alternant' | 'formateur'

const PART_LABELS: Record<Part, string> = {
  maitreApprentissage: "Maître d'apprentissage",
  alternant: 'Alternant',
  formateur: 'Formateur',
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR')
}

interface SequenceDocumentModalProps {
  sequenceId: string
  onClose: () => void
}

export default function SequenceDocumentModal({ sequenceId, onClose }: SequenceDocumentModalProps) {
  const [doc, setDoc] = useState<AlternantSequenceDocument | null>(null)
  const [activePart, setActivePart] = useState<Part>('maitreApprentissage')
  const [content, setContent] = useState<Record<Part, string>>({
    maitreApprentissage: '',
    alternant: '',
    formateur: '',
  })
  const [signature, setSignature] = useState<Record<Part, string>>({
    maitreApprentissage: '',
    alternant: '',
    formateur: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tous les modèles (système + périodiques) : pour pouvoir en choisir un
  // manuellement ici, pas seulement celui résolu automatiquement (`doc.template`).
  const [templates, setTemplates] = useState<AlternantDocumentTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  useEffect(() => {
    fetchSequenceDocument(sequenceId)
      .then((d) => {
        setDoc(d)
        setContent({
          maitreApprentissage: d.maitreApprentissage ?? '',
          alternant: d.alternant ?? '',
          formateur: d.formateur ?? '',
        })
        setSignature({
          maitreApprentissage: d.signatureMaitreApprentissage ?? '',
          alternant: d.signatureAlternant ?? '',
          formateur: d.signatureFormateur ?? '',
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
    fetchAlternantDocumentTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [sequenceId])

  // Applique le modèle choisi aux 3 parties en mémoire (pas encore enregistré) —
  // utile quand le modèle résolu automatiquement par Session ne convient pas à
  // cette SA précise (ex. alternant sur un titre professionnel différent).
  function handleApplyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    setContent({
      maitreApprentissage: template.maitreApprentissage,
      alternant: template.alternant,
      formateur: template.formateur,
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await saveSequenceDocument(sequenceId, {
        maitreApprentissage: content.maitreApprentissage,
        alternant: content.alternant,
        formateur: content.formateur,
        signatureMaitreApprentissage: signature.maitreApprentissage || null,
        signatureAlternant: signature.alternant || null,
        signatureFormateur: signature.formateur || null,
      })
      setDoc(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Repart du modèle vierge pour le texte de la partie affichée uniquement —
  // en mémoire, rien n'est perdu côté serveur tant qu'on ne clique pas
  // "Enregistrer". Ne touche plus la signature : les signatures sont
  // regroupées à la fin, indépendantes du texte de chaque partie.
  function handleResetToTemplate() {
    if (!doc?.template) return
    setContent((prev) => ({ ...prev, [activePart]: doc.template![activePart] ?? '' }))
  }

  async function handleDownloadPdf() {
    setDownloading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/peda/alternant-sequences/${sequenceId}/pdf`)
      if (!res.ok) throw new Error('Erreur lors de la génération du PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SA_${(doc?.header.alternantFullName ?? 'document').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération du PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconFile width={20} height={20} className="text-teal-700" />
            Document de séquence
            {doc && (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  doc.isSnapshotted ? 'bg-teal-700/10 text-teal-700' : 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]',
                ].join(' ')}
                title={
                  doc.isSnapshotted
                    ? 'Déjà rempli et enregistré pour cet alternant — un modèle modifié depuis ne change plus ce contenu.'
                    : "Encore le modèle par défaut, rien n'a été enregistré pour cette SA."
                }
              >
                {doc.isSnapshotted ? 'Modèle personnalisé' : 'Modèle par défaut'}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--ds-text-subtle)]">
            <IconLoader className="animate-spin" width={22} height={22} />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {doc && (
              <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3 text-sm text-[var(--ds-text-muted)]">
                <p>
                  <span className="font-semibold text-[var(--ds-text)]">{doc.header.alternantFullName}</span>
                  {doc.header.session && <> — {doc.header.session}</>}
                </p>
                {doc.header.mentorName && <p>Maître d'apprentissage : {doc.header.mentorName}</p>}
                {(doc.header.companyStartDate || doc.header.companyEndDate) && (
                  <p>
                    Période en entreprise : {formatDate(doc.header.companyStartDate)}
                    {doc.header.companyEndDate && <> au {formatDate(doc.header.companyEndDate)}</>}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sa-apply-template" className="text-xs font-medium text-[var(--ds-text-muted)]">
                Appliquer un modèle (remplace les 3 parties, non enregistré avant "Enregistrer")
              </label>
              <select
                id="sa-apply-template"
                value={selectedTemplateId}
                onChange={(e) => handleApplyTemplate(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 px-3 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-teal-700"
              >
                <option value="">— Choisir un modèle —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                label="Partie du document"
                size="sm"
                value={activePart}
                onChange={setActivePart}
                options={(['maitreApprentissage', 'alternant', 'formateur'] as Part[]).map((part) => ({
                  value: part,
                  label: PART_LABELS[part],
                }))}
              />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<IconRefresh width={14} height={14} />}
                onClick={handleResetToTemplate}
                disabled={!doc?.template}
                title="Remplace le texte et la signature de cette partie par le modèle vierge (non enregistré tant que tu ne cliques pas Enregistrer)"
              >
                Réinitialiser au modèle vierge
              </Button>
            </div>

            <div>
              <RichTextEditor
                value={content[activePart]}
                onChange={(html) => setContent((prev) => ({ ...prev, [activePart]: html }))}
                minHeight="160px"
              />
            </div>

            {/* Signatures regroupées à la fin (comme le tableau final des Word
                d'origine), pas une par partie — indépendantes de l'onglet actif. */}
            <div className="space-y-3 border-t border-[var(--ds-border)] pt-4">
              <h3 className="text-sm font-semibold text-[var(--ds-text)]">Signatures</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(['maitreApprentissage', 'alternant', 'formateur'] as Part[]).map((part) => (
                  <SignaturePad
                    key={part}
                    label={PART_LABELS[part]}
                    value={signature[part] || null}
                    onChange={(dataUrl) => setSignature((prev) => ({ ...prev, [part]: dataUrl }))}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button
            variant="secondary"
            leftIcon={<IconDownload width={16} height={16} />}
            onClick={handleDownloadPdf}
            isLoading={downloading}
            loadingLabel="Génération"
          >
            Télécharger le PDF
          </Button>
          <Button
            variant="primary"
            leftIcon={<IconSave width={16} height={16} />}
            onClick={handleSave}
            isLoading={saving}
            loadingLabel="Enregistrement"
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}
