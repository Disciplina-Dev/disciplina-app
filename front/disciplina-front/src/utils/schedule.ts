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

/**
 * Les réponses GraphQL mises en cache par urql portent un `__typename` sur chaque
 * objet. Ces objets finissent tels quels dans l'état local des formulaires, et
 * GraphQL refuse un champ inconnu en entrée de mutation (`Field "__typename" is
 * not defined by type "ScheduleSlotInput"`). On ne conserve donc que les champs
 * du type d'entrée avant l'envoi.
 */
export function toScheduleSlotInput(
  slots: OfferScheduleSlot[] | null | undefined,
): OfferScheduleSlot[] {
  return (slots ?? []).map((slot) => ({
    day: slot.day ?? null,
    startHour: slot.startHour ?? null,
    endHour: slot.endHour ?? null,
  }))
}

/** Équivalent de {@link toScheduleSlotInput} pour les créneaux d'immersion. */
export function toImmersionScheduleInput(
  slots: ImmersionScheduleSlot[] | null | undefined,
): ImmersionScheduleSlot[] {
  return (slots ?? []).map((slot) => ({
    day: slot.day ?? null,
    morningStartHour: slot.morningStartHour ?? null,
    morningEndHour: slot.morningEndHour ?? null,
    afternoonStartHour: slot.afternoonStartHour ?? null,
    afternoonEndHour: slot.afternoonEndHour ?? null,
  }))
}
