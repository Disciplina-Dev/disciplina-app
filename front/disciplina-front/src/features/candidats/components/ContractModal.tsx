import { useState } from 'react'
import { X, Briefcase, Loader2 } from 'lucide-react'
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
import { CompanySearchModal } from '@/features/matching/components/CompanySearchModal'
import { useCurrentUser } from '@/store/authStore'
import { useUpdateCandidate } from '@/graphql/hooks'
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
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      setStep('date')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de l\'offre')
      setStep('offer')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedOffer) return
    setLoading(true)
    setError('')
    try {
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
        footerAction={{ label: 'Offre introuvable ? Créer une entreprise', onClick: () => setStep('company') }}
        onConfirm={(jobs) => {
          if (jobs[0]) {
            setSelectedOffer(jobs[0])
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
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">Passer le candidat en contrat</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {loading && step === 'date' && !selectedOffer ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-blue" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-light text-blue">
                  <Briefcase className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedOffer?.companyInfos?.name ?? selectedOffer?.companyName ?? 'Entreprise'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">Date de début de contrat</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={() => setStep('offer')}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
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
