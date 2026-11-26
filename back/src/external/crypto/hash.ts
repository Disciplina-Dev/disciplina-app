import { createHash } from 'crypto';

// Utilisé pour ne jamais stocker un refresh token en clair en base (sha256, sortie hex).
export function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

/**
 * Empreinte courte (SHA-1 tronqué) d'un jeu de valeurs, pour l'identifier dans une
 * clé unique sans en stocker la liste (ex. les cibles d'un blocage de dates).
 * Usage d'identification uniquement : aucune garantie cryptographique attendue.
 */
export function shortHash(value: string, length = 12): string {
    return createHash('sha1').update(value).digest('hex').slice(0, length);
}
