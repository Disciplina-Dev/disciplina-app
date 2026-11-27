/** Âge atteint à la date du jour, calculé depuis la date de naissance. */
export function computeAge(dateOfBirth?: string | null): number | undefined {
  if (!dateOfBirth) return undefined
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age >= 0 ? age : undefined
}

/** Date de naissance au format JJ/MM/AAAA, lue depuis la partie date (sans fuseau, pour ne pas décaler d'un jour). */
export function formatDateOfBirth(dateOfBirth?: string | null): string | undefined {
  const match = dateOfBirth?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : undefined
}

/** Seuil "senior" pour un apprenti : 29 ans ou plus. */
export const SENIOR_AGE = 29

export function isSenior(age?: number | null): boolean {
  return age != null && age >= SENIOR_AGE
}
