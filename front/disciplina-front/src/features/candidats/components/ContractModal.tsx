import { useEffect, useState } from 'react'
import { IconClose, IconJob, IconLoader } from '@/components/ui/icons'
import { offerGraphqlClient, needsAnalysisGraphqlClient } from '@/graphql/client'
import {
  ADD_CANDIDATE_TO_OFFER,
  UPDATE_MATCHED_CANDIDATE_STATUS,
  UPDATE_OFFER,
  MARK_NEEDS_ANALYSIS_SIGNED,
  OFFERS_BY_NEEDS_ANALYSIS,
} from '@/graphql/queries'
import { MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'
import { OfferStatus } from '@/features/matching/constants/jobEnums'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import { CompanySearchModal } from '@/features/matching/components/CompanySearchModal'
import { useCurrentUser } from '@/store/authStore'
import { useUpdateCandidate } from '@/graphql/hooks'
import { fetchSessions } from '@/api/sessions'
import type { Session } from '@/types/session'
import { TRIAL_PERIOD_BUSINESS_DAYS, defaultTrialEndDate } from '@/utils/trialPeriod'
import { CandidateStatus, type Candidate, type MatchedOffer } from '@/types/candidate'
import JobSearchModal from './JobSearchModal'

interface ContractModalProps {
  candidate: Candidate
  onSuccess: (updated: Candidate) => void
  onClose: () => void
}

type Step = 'offer' | 'company' | 'date'

export default function ContractModal({ candidate, onSuccess, onClose }: ContractModalProps) {
  const currentUser = useCurrentUser()
  const { update: persistCandidate } = useUpdateCandidate()

  const [step, setStep] = useState<Step>('offer')
  const [selectedOffer, setSelectedOffer] = useState<MatchedOffer | null>(null)
  const [isNonRenseigne, setIsNonRenseigne] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [trialEndDate, setTrialEndDate] = useState('')
  const [trialTouched, setTrialTouched] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fin de période d'essai : pré-remplie à début + 45 jours ouvrés (lun–ven).
  // Recalculée dans `handleStartDateChange` tant que l'utilisateur ne l'a pas
  // modifiée manuellement (reste éditable dans tous les cas).
  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    if (!trialTouched) setTrialEndDate(value ? defaultTrialEndDate(value) : '')
  }

  // Liste des sessions pédagogiques (endpoint peda, accessible à tout EMPLOYEE).
  useEffect(() => {
    fetchSessions()
      .then((list) => {
        setSessions(list)
        setSessionsLoading(false)
      })
      .catch(() => {
        setSessions([])
        setSessionsLoading(false)
      })
  }, [])

  const candidateTpTypes = candidate.tp_types ?? []

  const handleAbCreated = async (needsAnalysisId: string) => {
    setLoading(true)
    setError('')
    try {
      await needsAnalysisGraphqlClient.mutation(MARK_NEEDS_ANALYSIS_SIGNED, { id: needsAnalysisId }).toPromise()
      const result = await offerGraphqlClient
        .query(OFFERS_BY_NEEDS_ANALYSIS, { needsAnalysisId })
        .toPromise()
      const offer = result.data?.offersByNeedsAnalysis?.[0]
      if (!offer) throw new Error("Aucune offre n'a été créée pour cette AB.")
      setSelectedOffer(offer)
      setIsNonRenseigne(false)
      setStep('date')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de l\'offre')
      setStep('offer')
    } finally {
      setLoading(false)
    }
  }

  const handleNonRenseigne = () => {
    setSelectedOffer(null)
    setIsNonRenseigne(true)
    setStep('date')
  }

  const handleConfirm = async () => {
    if (!selectedOffer && !isNonRenseigne) return
    setLoading(true)
    setError('')
    const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null
    const contractExtras = {
      contract_trial_end_date: trialEndDate || undefined,
      contract_session_id: selectedSession?.id ?? undefined,
      contract_session_name: selectedSession?.nom ?? undefined,
    }
    try {
      if (isNonRenseigne || !selectedOffer) {
        const updated: Candidate = {
          ...candidate,
          status: CandidateStatus.CONTRACT,
          contract_offer_id: undefined,
          contract_company_id: undefined,
          contract_company_name: 'Non renseigné',
          contract_start_date: startDate || undefined,
          ...contractExtras,
        }
        await persistCandidate(candidate._id, updated)
        onSuccess(updated)
        onClose()
        return
      }

      const offerId = selectedOffer.id
      await offerGraphqlClient.mutation(ADD_CANDIDATE_TO_OFFER, { offerId, candidateId: candidate._id }).toPromise()
      await offerGraphqlClient
        .mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { offerId, candidateId: candidate._id, status: MatchedCandidateStatus.CONTRACT })
        .toPromise()
      await offerGraphqlClient
        .mutation(UPDATE_OFFER, { id: offerId, offer: { id: offerId, status: OfferStatus.CONTRACT } })
        .toPromise()

      const updated: Candidate = {
        ...candidate,
        status: CandidateStatus.CONTRACT,
        contract_offer_id: offerId,
        contract_company_id: selectedOffer.companyInfos?.id,
        contract_company_name: selectedOffer.companyInfos?.name ?? selectedOffer.companyName,
        contract_start_date: startDate || undefined,
        ...contractExtras,
      }
      await persistCandidate(candidate._id, updated)
      onSuccess(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement du contrat')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'offer') {
    return (
      <JobSearchModal
        excludedJobIds={new Set()}
        candidateTpTypes={candidateTpTypes}
        singleSelect
        allowAnyTpOnSearch
        footerAction={{ label: 'Offre introuvable ? Créer une entreprise', onClick: () => setStep('company') }}
        onNonRenseigne={handleNonRenseigne}
        onConfirm={(jobs) => {
          if (jobs[0]) {
            setSelectedOffer(jobs[0])
            setIsNonRenseigne(false)
            setStep('date')
          }
        }}
        onClose={onClose}
      />
    )
  }

  if (step === 'company') {
    return (
      <CompanySearchModal
        open
        currentUser={currentUser}
        onClose={() => setStep('offer')}
        onSuccess={handleAbCreated}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
          <h2 className="text-base font-bold text-[var(--ds-text)]">Passer le candidat en contrat</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {loading && step === 'date' && !selectedOffer && !isNonRenseigne ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader width={20} height={20} className="animate-spin text-blue" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-light text-blue">
                  <IconJob className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-[var(--ds-text)]">
                    {isNonRenseigne ? 'Non renseigné' : (selectedOffer?.companyInfos?.name ?? selectedOffer?.companyName ?? 'Entreprise')}
                  </p>
                  {!isNonRenseigne && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(selectedOffer?.desiredTp ?? []).map(
                        (tp) =>
                          tp.tpType && (
                            <span
                              key={tp.tpType}
                              className="inline-flex items-center text-xs font-medium py-0.5 px-2 rounded-full bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)]"
                            >
                              {TP_TYPE_LABELS[tp.tpType]}
                            </span>
                          ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ds-text)]">Date de début de contrat</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ds-text)]">Date de fin de période d'essai</label>
                <input
                  type="date"
                  value={trialEndDate}
                  min={startDate || undefined}
                  onChange={(e) => { setTrialEndDate(e.target.value); setTrialTouched(true) }}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
                <p className="mt-1 text-xs text-[var(--ds-text-subtle)]">
                  Calculée automatiquement : +{TRIAL_PERIOD_BUSINESS_DAYS} jours ouvrés (lun–ven) depuis le début — modifiable.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ds-text)]">Session</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  disabled={sessionsLoading}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue disabled:opacity-50"
                >
                  <option value="">— Aucune —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}{s.filiere ? ` · ${s.filiere}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && <p className="text-xs text-[var(--ds-danger)]">{error}</p>}
        </div>

        <div className="flex justify-between gap-2 border-t border-[var(--ds-border)] p-4">
          <button
            onClick={() => { setIsNonRenseigne(false); setStep('offer') }}
            className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
          >
            Retour
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !startDate}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
