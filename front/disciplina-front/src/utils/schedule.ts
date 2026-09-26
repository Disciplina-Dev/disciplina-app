import type { ScheduleSlot } from '@/types/needsAnalysis'

export function formatScheduleSlots(
  slots: Array<ScheduleSlot | string | null | undefined> | null | undefined,
): string[] {
  if (!slots) return []
  return slots
    .map((slot) => {
      if (slot == null) return ''
      if (typeof slot === 'string') return slot
      const hours = [slot.startHour ?? '', slot.endHour ?? ''].filter(Boolean).join('-')
      return [slot.day ?? '', hours].filter(Boolean).join(' : ')
    })
    .filter(Boolean)
}