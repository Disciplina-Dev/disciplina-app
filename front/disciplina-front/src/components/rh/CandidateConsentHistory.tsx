import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { IconAlert, IconHistory } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { useCandidateConsentHistory, useWithdrawCandidateConsent } from '@/graphql/hooks'
import type { CandidateConsentEvent, CandidateConsentments, ConsentTypeKey } from '@/types/candidate'

/**
 * Historique des consentements + retrait (RGPD art. 7.1 et 7.3, GDPR_INF_08.2).
 * Le retrait est enregistré par le RH à la demande du candidat ; il prend effet
 * immédiatement côté serveur, sans attendre l'enregistrement du formulaire.
 */

const CONSENT_LABELS: Record<ConsentTypeKey, string> = {
  DATA_PROCESSING: 'Traitement des données',
  DATA_SHARING: 'Partage avec les entreprises',
  AI_PROCESSING: 'Traitement par IA',
  PHOTO_PROCESSING: 'Photo d’identité',
}

const CONSENT_FIELDS: Record<ConsentTypeKey, keyof CandidateConsentments> = {
  DATA_PROCESSING: 'data_processing',
  DATA_SHARING: 'data_sharing',
  AI_PROCESSING: 'ai_processing',
  PHOTO_PROCESSING: 'photo_processing',
}

const SOURCE_LABELS: Record<CandidateConsentEvent['source'], string> = {
  CREATE: 'création de la fiche',
  UPDATE: 'modification de la fiche',
  WITHDRAWAL: 'retrait',
  BACKFILL: 'reprise de l’existant',
}

function formatDate(iso: string) {
  try { return format(new Date(iso), 'd MMM yyyy à HH:mm', { locale: fr }) } catch { return iso }
}

interface CandidateConsentHistoryProps {
  candidateId: string
  /** État courant des consentements enregistrés (pas celui, non sauvegardé, du formulaire). */
  consentments: CandidateConsentments | undefined
  onWithdrawn: (consentments: CandidateConsentments) => void
}

export default function CandidateConsentHistory({ candidateId, consentments, onWithdrawn }: CandidateConsentHistoryProps) {
  const { events, loading, refetch } = useCandidateConsentHistory(candidateId)
  const { withdrawConsent } = useWithdrawCandidateConsent()
  const [confirming, setConfirming] = useState<ConsentTypeKey | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const granted = (Object.keys(CONSENT_FIELDS) as ConsentTypeKey[]).filter(
    (type) => consentments?.[CONSENT_FIELDS[type]] === true,
  )

  const handleWithdraw = async (type: ConsentTypeKey) => {
    setPending(true)
    setError(null)
    try {
      const updated = await withdrawConsent(candidateId, [type])
      onWithdrawn(updated)
      setConfirming(null)
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrait impossible')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-4">
      <div className="flex items-center gap-2">
        <IconHistory className="h-4 w-4 text-blue" />
        <h4 className="text-sm font-semibold text-[var(--ds-text)]">Retrait et historique des consentements</h4>
      </div>

      {granted.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--ds-text-muted)]">
            À la demande du candidat, un consentement peut être retiré à tout moment. Le retrait est immédiat et tracé.
          </p>
          {granted.map((type) => (
            <div key={type} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-[var(--ds-text)]">{CONSENT_LABELS[type]}</span>
              {confirming === type ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ds-text-muted)]">Confirmer le retrait ?</span>
                  <Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => handleWithdraw(type)}>
                    Retirer
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="secondary" onClick={() => { setError(null); setConfirming(type) }}>
                  Retirer le consentement
                </Button>
              )}
            </div>
          ))}
          {confirming === 'DATA_PROCESSING' && (
            <p className="flex items-start gap-2 text-xs text-[var(--ds-warning)]">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Ce retrait n’efface pas la fiche : si le candidat demande l’effacement de ses données, traitez-le comme une demande d’effacement distincte.
            </p>
          )}
          {error && <p className="text-xs text-[var(--ds-danger)]">{error}</p>}
        </div>
      )}

      {loading && <p className="text-xs text-[var(--ds-text-muted)]">Chargement de l’historique…</p>}
      {!loading && events.length === 0 && (
        <p className="text-xs text-[var(--ds-text-muted)]">Aucun événement enregistré.</p>
      )}
      {!loading && events.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {events.map((event, i) => (
            <li key={`${event.recordedAt}-${event.consentType}-${i}`} className="text-xs text-[var(--ds-text-muted)]">
              <span className={event.action === 'GRANT' ? 'font-medium text-[var(--ds-success)]' : 'font-medium text-[var(--ds-danger)]'}>
                {event.action === 'GRANT' ? 'Accordé' : 'Retiré'}
              </span>
              {' · '}
              <span className="text-[var(--ds-text)]">{CONSENT_LABELS[event.consentType]}</span>
              {' · '}
              {formatDate(event.recordedAt)}
              {' · '}
              {event.recordedByName ? `par ${event.recordedByName}` : 'automatique'}
              {` (${SOURCE_LABELS[event.source]}, texte ${event.consentVersion})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
