import { IconCheck } from '@/components/ui/icons'
import type { ImmersionScheduleSlot } from '@/types/candidate'

const IMMERSION_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

type HourField =
  | 'morningStartHour'
  | 'morningEndHour'
  | 'afternoonStartHour'
  | 'afternoonEndHour'

// Journée continue par défaut (08:00 → 17:00) : les heures de coupure
// (fin de matinée / début d'après-midi) restent vides tant que l'utilisateur
// ne souhaite pas scinder la journée en deux shifts.
const DEFAULT_SLOT: Omit<ImmersionScheduleSlot, 'day'> = {
  morningStartHour: '08:00',
  morningEndHour: null,
  afternoonStartHour: null,
  afternoonEndHour: '17:00',
}

const INPUT_CLASS =
  'w-24 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1.5 text-sm text-[var(--ds-text)] outline-none focus:border-blue disabled:cursor-not-allowed disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]'

/**
 * Éditeur compact des horaires d'immersion : chaque jour est activable et peut
 * porter deux plages facultatives (matin / après-midi). Toutes les heures sont
 * optionnelles — omettre la fin du matin et/ou le début de l'après-midi n'est
 * jamais bloquant. Seuls les jours activés sont persistés.
 */
export default function ImmersionScheduleEditor({ value, onChange }: {
  value: ImmersionScheduleSlot[]
  onChange: (slots: ImmersionScheduleSlot[]) => void
}) {
  const slotFor = (day: string) => value.find((s) => s.day === day)
  const setHour = (day: string, field: HourField, hour: string) => {
    onChange(value.map((s) => (s.day === day ? { ...s, [field]: hour } : s)))
  }
  const setEnabled = (day: string, on: boolean) => {
    const others = value.filter((s) => s.day !== day)
    onChange(on ? [...others, { day, ...DEFAULT_SLOT }] : others)
  }

  const timeInput = (
    day: string,
    label: string,
    field: HourField,
    enabled: boolean,
    hour?: string | null,
  ) => (
    <input
      type="time"
      aria-label={`${label} ${day}`}
      disabled={!enabled}
      value={hour ?? ''}
      onChange={(e) => setHour(day, field, e.target.value)}
      className={INPUT_CLASS}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      {IMMERSION_DAYS.map((day) => {
        const slot = slotFor(day)
        const enabled = !!slot
        return (
          <div key={day} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => setEnabled(day, !enabled)}
              className={[
                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
                enabled ? 'border-blue bg-blue' : 'border-[var(--ds-border-strong)] bg-[var(--ds-surface)]',
              ].join(' ')}
              aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${day}`}
            >
              {enabled && <IconCheck width={12} height={12} className="text-white" strokeWidth={3} />}
            </button>
            <span className={enabled ? 'w-20 text-sm font-medium text-[var(--ds-text)]' : 'w-20 text-sm text-[var(--ds-text-subtle)]'}>
              {day}
            </span>
            <span className={enabled ? 'text-xs font-medium text-[var(--ds-text-muted)]' : 'text-xs text-[var(--ds-text-subtle)]'}>
              Matin
            </span>
            {timeInput(day, 'Début matin', 'morningStartHour', enabled, slot?.morningStartHour)}
            <span className="text-xs text-[var(--ds-text-subtle)]">→</span>
            {timeInput(day, 'Fin matin', 'morningEndHour', enabled, slot?.morningEndHour)}
            <span className={enabled ? 'ml-1 text-xs font-medium text-[var(--ds-text-muted)]' : 'ml-1 text-xs text-[var(--ds-text-subtle)]'}>
              Après-midi
            </span>
            {timeInput(day, 'Début après-midi', 'afternoonStartHour', enabled, slot?.afternoonStartHour)}
            <span className="text-xs text-[var(--ds-text-subtle)]">→</span>
            {timeInput(day, 'Fin après-midi', 'afternoonEndHour', enabled, slot?.afternoonEndHour)}
          </div>
        )
      })}
      <p className="text-xs text-[var(--ds-text-subtle)]">
        Toutes les heures sont facultatives : laissez la fin du matin / le début de
        l&apos;après-midi vides pour une journée continue, ou renseignez les deux plages
        pour deux shifts le même jour.
      </p>
    </div>
  )
}
