import { useState } from 'react'
import { X } from 'lucide-react'
import { INTERVIEW_CONCLUSION_LABELS, InterviewConclusion } from '@/constants/interviewConclusion'

interface InterviewConclusionModalProps {
  candidateName?: string
  onSubmit: (conclusion: InterviewConclusion, immersionStartDate?: string, immersionEndDate?: string) => void
  onClose: () => void
}

const CONCLUSION_OPTIONS = [
  InterviewConclusion.REJECTED,
  InterviewConclusion.IMMERSING,
  InterviewConclusion.CONTRACT,
  InterviewConclusion.PRESENT,
  InterviewConclusion.ABSENT,
  InterviewConclusion.APPOINTMENT_CANCELLED,
]

export default function InterviewConclusionModal({ candidateName, onSubmit, onClose }: InterviewConclusionModalProps) {
  const [conclusion, setConclusion] = useState<InterviewConclusion | null>(null)
  const [immersionStartDate, setImmersionStartDate] = useState('')
  const [immersionEndDate, setImmersionEndDate] = useState('')

  const isImmersing = conclusion === InterviewConclusion.IMMERSING
  const canSubmit = conclusion !== null && (!isImmersing || (immersionStartDate && immersionEndDate))

  const handleSubmit = () => {
    if (!canSubmit || !conclusion) return
    onSubmit(conclusion, isImmersing ? immersionStartDate : undefined, isImmersing ? immersionEndDate : undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">Conclure l'entretien{candidateName ? ` — ${candidateName}` : ''}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {CONCLUSION_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setConclusion(option)}
                className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  conclusion === option ? 'border-blue bg-blue/5 text-blue' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {INTERVIEW_CONCLUSION_LABELS[option]}
              </button>
            ))}
          </div>

          {isImmersing && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-800">Date de début d'immersion</label>
                <input
                  type="date"
                  value={immersionStartDate}
                  onChange={(e) => setImmersionStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-800">Date de fin d'immersion</label>
                <input
                  type="date"
                  value={immersionEndDate}
                  onChange={(e) => setImmersionEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
