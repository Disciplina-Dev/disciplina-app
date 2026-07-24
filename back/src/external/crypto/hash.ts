import { createHash } from 'crypto';

// Utilisé pour ne jamais stocker un refresh token en clair en base (sha256, sortie hex).
export function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}
