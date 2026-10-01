import { useState } from 'react'
import { IconClose, IconCompany, IconPortfolio, IconSchedule } from '@/components/ui/icons'
import { offerGraphqlClient } from '@/graphql/client'
import {
  ADD_CANDIDATE_TO_OFFER,
  UPDATE_MATCHED_CANDIDATE_STATUS,
  ADD_MANUAL_PROPOSED_CANDIDATE,
  ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION,
} from '@/graphql/queries'
import LocationAutocompleteInput from '@/features/matching/components/LocationAutocompleteInput'
import { MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'

type Choice = 'company' | 'interview' | 'immersion'

interface AddCandidateToJobModalProps {
  job: { id: string; companyName?: string }
  candidateId: string
  onSubmit: () => void
  onClose: () => void
  progressLabel?: string
}

export default function AddCandidateToJobModal({ job, candidateId, onSubmit, onClose, progressLabel }: AddCandidateToJobModalProps) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [interviewLocation, setInterviewLocation] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewHour, setInterviewHour] = useState('')

  const [immersionLocation, setImmersionLocation] = useState('')
  const [immersionStartDate, setImmersionStartDate] = useState('')
  const [immersionEndDate, setImmersionEndDate] = useState('')

  const proposeToCompany = async () => {
    const added = await offerGraphqlClient.mutation(ADD_CANDIDATE_TO_OFFER, { offerId: job.id, candidateId }).toPromise()
    if (added.error) throw new Error(added.error.message)
    const updated = await offerGraphqlClient
      .mutation(UPDATE_MATCHED_CANDIDATE_STATUS, { offerId: job.id, candidateId, status: MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND })
      .toPromise()
    if (updated.error) throw new Error(updated.error.message)
  }

  const scheduleInterview = async () => {
    const result = await offerGraphqlClient
      .mutation(ADD_MANUAL_PROPOSED_CANDIDATE, {
        offerId: job.id,
        candidateId,
        interviewDate,
        interviewHour,
        interviewLocation,
      })
      .toPromise()
    if (result.error) throw new Error(result.error.message)
  }

  const proposeImmersion = async () => {
    const result = await offerGraphqlClient
      .mutation(ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION, {
        offerId: job.id,
        candidateId,
        immersionStartDate,
        immersionEndDate,
        immersionLocation,
      })
      .toPromise()
    if (result.error) throw new Error(result.error.message)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      if (choice === 'company') await proposeToCompany()
      else if (choice === 'interview') await scheduleInterview()
      else if (choice === 'immersion') await proposeImmersion()
      onSubmit()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitDisabled =
    submitting ||
    (choice === 'interview' && (!interviewLocation || !interviewDate || !interviewHour)) ||
    (choice === 'immersion' && (!immersionLocation || !immersionStartDate || !immersionEndDate))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--ds-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] p-5">
          <div>
            <h2 className="text-base font-bold text-[var(--ds-text)]">
              {job.companyName ?? 'Entreprise'}
            </h2>
            {progressLabel && <p className="mt-0.5 text-xs text-[var(--ds-text-subtle)]">{progressLabel}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {choice === null && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setChoice('company')}
                className="flex items-center gap-3 rounded-lg border border-[var(--ds-border)] px-4 py-3 text-left text-sm hover:bg-[var(--ds-surface-sunken)] transition-colors"
              >
                <IconCompany width={18} height={18} className="text-blue" />
                <span className="font-medium text-[var(--ds-text)]">Pré-sélectionné le candidat</span>
              </button>
              <button
                onClick={() => setChoice('interview')}
                className="flex items-center gap-3 rounded-lg border border-[var(--ds-border)] px-4 py-3 text-left text-sm hover:bg-[var(--ds-surface-sunken)] transition-colors"
              >
                <IconSchedule width={18} height={18} className="text-blue" />
                <span className="font-medium text-[var(--ds-text)]">Programmer un entretien</span>
              </button>
              <button
                onClick={() => setChoice('immersion')}
                className="flex items-center gap-3 rounded-lg border border-[var(--ds-border)] px-4 py-3 text-left text-sm hover:bg-[var(--ds-surface-sunken)] transition-colors"
              >
                <IconPortfolio width={18} height={18} className="text-blue" />
                <span className="font-medium text-[var(--ds-text)]">Proposer une immersion</span>
              </button>
            </div>
          )}

          {choice === 'interview' && (
            <div className="flex flex-col gap-4">
              <LocationAutocompleteInput label="Lieu de l'entretien" value={interviewLocation} onChange={setInterviewLocation} />
              <div>
                <label className="block mb-2 text-sm font-semibold text-[var(--ds-text)]">Date</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-[var(--ds-text)]">Heure</label>
                <input
                  type="time"
                  value={interviewHour}
                  onChange={(e) => setInterviewHour(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
            </div>
          )}

          {choice === 'immersion' && (
            <div className="flex flex-col gap-4">
              <LocationAutocompleteInput label="Lieu de l'immersion" value={immersionLocation} onChange={setImmersionLocation} />
              <div>
                <label className="block mb-2 text-sm font-semibold text-[var(--ds-text)]">Date de début</label>
                <input
                  type="date"
                  value={immersionStartDate}
                  onChange={(e) => setImmersionStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-[var(--ds-text)]">Date de fin</label>
                <input
                  type="date"
                  value={immersionEndDate}
                  onChange={(e) => setImmersionEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-xs text-[var(--ds-danger)]">{error}</p>}
        </div>

        <div className="flex justify-between gap-2 border-t border-[var(--ds-border)] p-4">
          <button
            onClick={() => (choice === null ? onClose() : setChoice(null))}
            className="rounded-lg border border-[var(--ds-border)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
          >
            {choice === null ? 'Annuler' : 'Retour'}
          </button>
          {choice !== null && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
