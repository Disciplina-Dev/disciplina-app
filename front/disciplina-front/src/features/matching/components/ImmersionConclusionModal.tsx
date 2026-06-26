import { useState } from 'react'
import { X } from 'lucide-react'
import { IMMERSION_CONCLUSION_LABELS, ImmersionConclusion } from '@/constants/immersionConclusion'

interface ImmersionConclusionModalProps {
  candidateName?: string
  immersionStartDate?: string
  immersionEndDate?: string
  onSubmit: (conclusion: ImmersionConclusion) => void
  onClose: () => void
}

const CONCLUSION_OPTIONS = [ImmersionConclusion.REJECTED, ImmersionConclusion.CONTRACT]

export default function ImmersionConclusionModal({
  candidateName,
  immersionStartDate,
  immersionEndDate,
  onSubmit,
  onClose,
}: ImmersionConclusionModalProps) {
  const [conclusion, setConclusion] = useState<ImmersionConclusion | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Conclure l'immersion{candidateName ? ` — ${candidateName}` : ''}</h2>
            {immersionStartDate && immersionEndDate && (
              <p className="mt-0.5 text-xs text-gray-500">Du {immersionStartDate} au {immersionEndDate}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
          {CONCLUSION_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setConclusion(option)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                conclusion === option ? 'border-blue bg-blue/5 text-blue' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {IMMERSION_CONCLUSION_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="flex justify-between gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => conclusion && onSubmit(conclusion)}
            disabled={!conclusion}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
