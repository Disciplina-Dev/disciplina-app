import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheckCircle, IconClose, IconFile, IconSend } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Select from '@/components/ui/Select'
import { apiJson } from '@/api/httpClient'
import { fetchAttestation } from '@/api/emargement'
import { cleanHtml } from '@/services/sanitizeHtml'
import { useMailTemplatesStore, type MailAttachment } from '@/store/mailTemplatesStore'
import { blobToBase64, downloadBlob } from '@/utils/download'
import { formatDay } from '@/utils/emargement'

type AttestationAction = 'download' | 'mail'

/** Données de l'alternant nécessaires au document et aux variables du modèle. */
export interface AttestationAlternant {
  id: string
  fullName: string
  firstName: string
  lastName: string
  email: string | null
  companyName: string | null
}

interface AttestationModalProps {
  alternant: AttestationAlternant
  /** Bornes des feuilles d'émargement disponibles : préremplissent la période. */
  availableFrom: string | null
  availableTo: string | null
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Émission de l'attestation d'assiduité : période (du / au, ou toute la période),
 * puis téléchargement du PDF ou envoi par mail à l'entreprise.
 *
 * L'envoi passe par `/api/email/send` : le document part depuis la boîte Gmail
 * du Peda connecté, avec le modèle mail choisi (variables `{nom}`, `{prenom}`,
 * `{mail}` remplacées comme le fait `PedaDraftService` côté back) et la
 * signature du service pédagogique.
 */
export default function AttestationModal({
  alternant,
  availableFrom,
  availableTo,
  onClose,
}: AttestationModalProps) {
  const { templates, signatureImage, loading: templatesLoading, load, resolveAttachment } =
    useMailTemplatesStore('peda')

  const [action, setAction] = useState<AttestationAction>('download')
  const [from, setFrom] = useState(availableFrom?.slice(0, 10) ?? '')
  const [to, setTo] = useState(availableTo?.slice(0, 10) ?? '')
  const [allPeriod, setAllPeriod] = useState(false)
  const [email, setEmail] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [running, setRunning] = useState<AttestationAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Modèles et signature (Drive) chargés seulement quand l'envoi par mail est demandé.
  useEffect(() => {
    if (action === 'mail') load()
  }, [action, load])

  const hasAvailableRange = Boolean(availableFrom && availableTo)
  const sigHtml = signatureImage
    ? `<br/><img src="${signatureImage}" alt="signature" style="width:100%;max-width:480px;height:auto"/>`
    : ''

  // Un seul modèle : inutile de faire choisir. Calculé plutôt que posé en état
  // pour éviter un setState dans un effet.
  const effectiveTemplateId = templateId || (templates.length === 1 ? templates[0].id : '')
  const template = templates.find((t) => t.id === effectiveTemplateId) ?? null

  function fillVariables(text: string): string {
    return text
      .replace(/\{\{?\s*nom\s*\}?\}/gi, alternant.lastName)
      .replace(/\{\{?\s*prenom\s*\}?\}/gi, alternant.firstName)
      .replace(/\{\{?\s*mail\s*\}?\}/gi, alternant.email ?? '')
  }

  const subjectPreview = template ? fillVariables(template.subject) : ''
  const bodyPreview = template ? `${fillVariables(template.body)}${sigHtml}` : ''

  async function run() {
    setError(null)
    if (!allPeriod) {
      if (!from || !to) {
        setError('Indiquez les deux dates de la période, ou choisissez « Toute la période ».')
        return
      }
      if (from > to) {
        setError('La date de début doit précéder la date de fin.')
        return
      }
    }
    if (action === 'mail') {
      if (!EMAIL_RE.test(email.trim())) {
        setError('Saisissez l’adresse e-mail du destinataire (entreprise).')
        return
      }
      if (!template) {
        setError('Choisissez un modèle de mail.')
        return
      }
    }

    setRunning(action)
    try {
      const period = allPeriod ? {} : { from, to }
      const pdf = await fetchAttestation(alternant.id, period)
      if (action === 'download') {
        downloadBlob(pdf.blob, pdf.fileName)
        setRunning(null)
        onClose()
        return
      }

      const attachments: MailAttachment[] = [
        { filename: pdf.fileName, contentType: 'application/pdf', content: await blobToBase64(pdf.blob) },
      ]
      if (template?.attachment) {
        // Pièce jointe du modèle (stockée sur Drive) : facultative, l'envoi continue sans elle.
        try {
          attachments.push(await resolveAttachment(template.id))
        } catch {
          // Sans conséquence : l'attestation reste jointe.
        }
      }

      await apiJson('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.trim(),
          subject: subjectPreview,
          body: bodyPreview,
          attachments,
        }),
      })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm"
        onClick={() => {
          if (running === null) onClose()
        }}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconFile width={20} height={20} className="text-[var(--ds-accent)]" />
            Attestation d’assiduité — {alternant.fullName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-success-bg)]">
              <IconCheckCircle width={22} height={22} className="text-[var(--ds-success)]" />
            </div>
            <p className="font-medium text-[var(--ds-text)]">Attestation envoyée à {email.trim()}</p>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <>
            <div className="ds-scroll space-y-5 overflow-y-auto px-6 py-5">
              <SegmentedControl<AttestationAction>
                label="Sort de l’attestation"
                value={action}
                onChange={(next) => {
                  if (running !== null) return
                  setAction(next)
                  setError(null)
                }}
                options={[
                  { value: 'download', label: 'Télécharger' },
                  { value: 'mail', label: 'Envoyer par mail' },
                ]}
              />

              <div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1">
                    <InputField
                      id="attestation-from"
                      label="Du"
                      type="date"
                      value={from}
                      max={to || undefined}
                      disabled={allPeriod || running !== null}
                      onChange={(e) => {
                        setAllPeriod(false)
                        setFrom(e.target.value)
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      id="attestation-to"
                      label="Au"
                      type="date"
                      value={to}
                      min={from || undefined}
                      disabled={allPeriod || running !== null}
                      onChange={(e) => {
                        setAllPeriod(false)
                        setTo(e.target.value)
                      }}
                    />
                  </div>
                  <Button
                    variant={allPeriod ? 'subtle' : 'secondary'}
                    size="sm"
                    aria-pressed={allPeriod}
                    disabled={running !== null}
                    onClick={() => setAllPeriod((value) => !value)}
                  >
                    Toute la période
                  </Button>
                </div>
                <p className="mt-2 text-[12px] text-[var(--ds-text-subtle)]">
                  {allPeriod
                    ? 'Toute la période : toutes les séances émargées de l’alternant, sans filtre de dates.'
                    : hasAvailableRange
                      ? `Données disponibles : du ${formatDay(availableFrom)} au ${formatDay(availableTo)}.`
                      : 'Aucune feuille d’émargement sur la période.'}
                </p>
              </div>

              {action === 'mail' && (
                <div className="space-y-4 border-t border-[var(--ds-border)] pt-4">
                  <InputField
                    id="attestation-email"
                    label="Destinataire (entreprise)"
                    type="email"
                    required
                    placeholder="contact@entreprise.fr"
                    value={email}
                    disabled={running !== null}
                    hint={
                      alternant.companyName
                        ? `Adresse du contact entreprise — entreprise liée : ${alternant.companyName}.`
                        : 'Adresse du contact entreprise.'
                    }
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  {templatesLoading ? (
                    <p className="text-[13px] text-[var(--ds-text-subtle)]">Chargement des modèles…</p>
                  ) : templates.length === 0 ? (
                    <p className="text-[13px] text-[var(--ds-text-muted)]">
                      Aucun modèle mail pour le Peda.{' '}
                      <Link to="/peda/mail" className="font-semibold text-[var(--ds-accent)] hover:underline">
                        Créer un modèle
                      </Link>
                      .
                    </p>
                  ) : (
                    <Select<string>
                      label="Modèle de mail"
                      placeholder="— Choisir un modèle —"
                      options={templates.map((t) => ({ value: t.id, label: t.name }))}
                      value={effectiveTemplateId}
                      disabled={running !== null}
                      onChange={setTemplateId}
                    />
                  )}

                  {template && (
                    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] px-3 py-2">
                      <p className="text-[12px] font-semibold text-[var(--ds-text)]">{subjectPreview}</p>
                      <div
                        className="ds-scroll mt-1 max-h-40 overflow-y-auto text-[12px] text-[var(--ds-text-muted)]"
                        // Aperçu du modèle saisi dans l'application — assaini avant rendu.
                        dangerouslySetInnerHTML={{ __html: cleanHtml(bodyPreview) }}
                      />
                    </div>
                  )}

                  <p className="text-[12px] text-[var(--ds-text-subtle)]">
                    L’attestation part en pièce jointe depuis votre boîte Gmail connectée.
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
              <Button variant="ghost" onClick={onClose} disabled={running !== null}>
                Annuler
              </Button>
              <Button
                variant="primary"
                leftIcon={action === 'mail' ? <IconSend width={15} height={15} /> : undefined}
                isLoading={running === action}
                disabled={running !== null || (action === 'mail' && templates.length === 0)}
                onClick={run}
              >
                {action === 'download' ? 'Télécharger le PDF' : 'Envoyer le mail'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
