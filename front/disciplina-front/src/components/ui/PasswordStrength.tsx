type StrengthLevel = 0 | 1 | 2 | 3 | 4

const SEGMENT_COLORS: Record<StrengthLevel, string> = {
  0: 'bg-gray-100',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-success',
  4: 'bg-success',
}

const LABEL_COLORS: Record<StrengthLevel, string> = {
  0: 'text-gray-300',
  1: 'text-danger',
  2: 'text-warning',
  3: 'text-success',
  4: 'text-success',
}

const LABELS: Record<StrengthLevel, string> = {
  0: '',
  1: 'Faible',
  2: 'Moyen',
  3: 'Fort',
  4: 'Très fort',
}

function getStrength(password: string): StrengthLevel {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score as StrengthLevel
}

type PasswordStrengthProps = {
  password: string
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = getStrength(password)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => i + 1).map((i) => (
          <div
            key={i}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= strength ? SEGMENT_COLORS[strength] : 'bg-gray-100',
            ].join(' ')}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={['text-xs', LABEL_COLORS[strength]].join(' ')}>
          {LABELS[strength]}
        </p>
      )}
    </div>
  )
}
