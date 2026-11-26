// Validateurs transverses partagés entre modules REST/GraphQL.
// Volontairement simples (pas de dépendance : zod est banni) et cohérents :
// une seule source pour la forme d'un email, au lieu de trois regex divergentes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): boolean {
    return typeof value === 'string' && EMAIL_RE.test(value);
}

const PHONE_RE = /^\+?\d{6,15}$/;

/**
 * Nettoie un numéro de téléphone saisi librement (espaces, points, tirets,
 * parenthèses) puis le valide. Retourne `''` si le numéro n'est pas exploitable.
 */
export function normalizePhone(value: unknown): string {
    if (typeof value !== 'string') return '';
    const cleaned = value.replace(/[\s.\-()]/g, '');
    return PHONE_RE.test(cleaned) ? cleaned : '';
}
