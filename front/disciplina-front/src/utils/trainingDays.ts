const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi',
}

const STATUS_LABELS: Record<string, string> = { OUI: '✓', NON: '✗', PREFERE: '~' }

function periodsToLabel(v: unknown): string {
  if (Array.isArray(v)) {
    if (v.includes('PREFERE')) return '~'
    return v.length > 0 ? '✓' : '✗'
  }
  return STATUS_LABELS[v as string] ?? String(v)
}

export function formatTrainingDays(raw?: string | null): string | null {
  if (!raw) return null
  try {
    const days = JSON.parse(raw)
    return Object.entries(days)
      .map(([k, v]) => `${DAY_LABELS[k] ?? k}: ${periodsToLabel(v)}`)
      .join('  •  ')
  } catch {
    return raw
  }
}
