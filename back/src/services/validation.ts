// Validateurs transverses partagés entre modules REST/GraphQL.
// Volontairement simples (pas de dépendance : zod est banni) et cohérents :
// une seule source pour la forme d'un email, au lieu de trois regex divergentes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): boolean {
    return typeof value === 'string' && EMAIL_RE.test(value);
}
