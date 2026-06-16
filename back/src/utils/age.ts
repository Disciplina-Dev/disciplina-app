/** Âge atteint aujourd'hui, calculé depuis la date de naissance. */
export function computeAge(dateOfBirth?: Date | string | null): number | undefined {
    if (!dateOfBirth) return undefined;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return undefined;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : undefined;
}
