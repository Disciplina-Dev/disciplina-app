import { IconCheck, IconClose, IconFavorite } from '@/components/ui/icons'
import type { ProposedAnswer } from '@/api/match'

const OPTIONS: { value: ProposedAnswer; label: string; icon: typeof IconFavorite; activeClass: string }[] = [
  { value: 'FAVORITE', label: 'Coup de cœur', icon: IconFavorite, activeClass: 'border-purple bg-purple text-white' },
  { value: 'ACCEPTED', label: 'Accepter', icon: IconCheck, activeClass: 'border-success bg-success text-white' },
  { value: 'REFUSED', label: 'Refuser', icon: IconClose, activeClass: 'border-danger bg-danger text-white' },
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
              active ? activeClass : 'border-[var(--ds-border)] text-[var(--ds-text-muted)] hover:border-purple'
            }`}
          >
            <Icon width={15} height={15} /> {label}
          </button>
        )
      })}
    </div>
  )
}
