import type { ImmersionScheduleSlot } from '@/types/candidate'
import type { ScheduleSlot as OfferScheduleSlot } from '@/types/needsAnalysis'

export function formatScheduleSlots(
  slots: Array<OfferScheduleSlot | string | null | undefined> | null | undefined,
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

/**
 * Convertit un créneau d'offre (`startHour`/`endHour`) en créneau d'immersion.
 * L'horaire continu de l'offre reste continu : début le matin, fin l'après-midi,
 * sans coupure — l'utilisateur peut ensuite renseigner une fin de matinée et un
 * début d'après-midi pour scinder la journée en deux shifts.
 */
export function offerSlotToImmersionSlot(slot: OfferScheduleSlot): ImmersionScheduleSlot {
  return {
    day: slot.day ?? null,
    morningStartHour: slot.startHour ?? null,
    morningEndHour: null,
    afternoonStartHour: null,
    afternoonEndHour: slot.endHour ?? null,
  }
}
