import { useEffect, useState } from 'react'
import { IconClose, IconDownload, IconFile, IconLoader, IconRefresh, IconSave } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SignaturePad from '@/components/ui/SignaturePad'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { apiFetch } from '@/api/httpClient'
import { fetchSequenceDocument, saveSequenceDocument } from '@/api/alternantDocumentTemplates'
import type { AlternantSequenceDocument } from '@/types/alternantDocumentTemplate'

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
  }, [sequenceId])

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

  // Repart du modèle vierge pour la partie affichée uniquement — en mémoire,
  // rien n'est perdu côté serveur tant qu'on ne clique pas "Enregistrer".
  function handleResetToTemplate() {
    if (!doc?.template) return
    setContent((prev) => ({ ...prev, [activePart]: doc.template![activePart] ?? '' }))
    setSignature((prev) => ({ ...prev, [activePart]: '' }))
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

            <SignaturePad
              // `SignaturePad` ne lit `value` qu'au montage (dessin initial sur
              // canvas) — une `key` par partie force un vrai remount au lieu
              // d'un remplacement silencieux qui garderait l'ancien tracé.
              key={activePart}
              label={`Signature — ${PART_LABELS[activePart]}`}
              value={signature[activePart] || null}
              onChange={(dataUrl) => setSignature((prev) => ({ ...prev, [activePart]: dataUrl }))}
            />

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
