import { Heart, Check, X } from 'lucide-react'
import type { ProposedAnswer } from '@/api/match'

const OPTIONS: { value: ProposedAnswer; label: string; icon: typeof Heart; activeClass: string }[] = [
  { value: 'FAVORITE', label: 'Coup de cœur', icon: Heart, activeClass: 'border-purple bg-purple text-white' },
  { value: 'ACCEPTED', label: 'Accepter', icon: Check, activeClass: 'border-success bg-success text-white' },
  { value: 'REFUSED', label: 'Refuser', icon: X, activeClass: 'border-danger bg-danger text-white' },
]

export default function AnswerControls({
  value,
  onChange,
}: {
  value: ProposedAnswer | null
  onChange: (answer: ProposedAnswer) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(({ value: option, label, icon: Icon, activeClass }) => {
        const active = value === option
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-bold transition-colors ${
              active ? activeClass : 'border-gray-200 text-gray-600 hover:border-purple'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        )
      })}
    </div>
  )
}
