/**
 * Erreur métier portant un statut HTTP et un code stable (lu par le front).
 * Reste une `Error` simple (pas de classe custom, cf. CONVENTION.md).
 */
export function httpError(status: number, code: string, message: string): Error {
    return Object.assign(new Error(message), { status, code });
}
