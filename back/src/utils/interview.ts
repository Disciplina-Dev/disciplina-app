/** Vrai si la date/heure d'entretien est déjà passée par rapport à maintenant. */
export function isInterviewDatePast(interviewSlot?: string): boolean {
    if (!interviewSlot) return false;
    return new Date(interviewSlot).getTime() < Date.now();
}
