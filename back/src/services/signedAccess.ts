// Éléments partagés par les deux flux de « lien magique » à usage limité —
// InterviewAccessService et MatchLinkService — dont les couches sont en miroir.
// Volontairement limité aux briques sûres (type, constante, fonction pure) :
// l'unification complète des repositories/guards/tokens reste un chantier dédié
// (voir docs/AUDIT.md §3.4).

export const MAX_ATTEMPTS = 3;

export type AuthResult =
    | { ok: true; token: string }
    | { ok: false; reason: 'invalid' | 'locked' | 'expired'; remaining?: number };

export function isSignedAccessExpired(row: { expires_at: string | Date }): boolean {
    return new Date(row.expires_at).getTime() < Date.now();
}
