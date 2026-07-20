import { Permission } from '../types/user.types';

// Hiérarchie des permissions : un niveau supérieur accède à tout ce qu'un niveau
// inférieur peut voir. Les index 0=EMPLOYEE < 1=RESPONSABLE < 2=ADMIN sont
// implicites par l'ordre de définition dans l'enum (les strings sont ordonnées
// par l'ordre de déclaration dans le fichier — on utilise un mapping explicite).
const PERMISSION_LEVEL: Record<string, number> = {
    [Permission.EMPLOYEE]: 1,
    [Permission.RESPONSABLE]: 2,
    [Permission.ADMIN]: 3,
};

/**
 * Vérifie que l'utilisateur a le niveau de permission suffisant.
 * ADMIN peut tout faire ; RESPONSABLE peut tout ce qu'EMPLOYEE peut.
 * allowedRoles est conservé pour la compatibilité (utilisé avec des noms de
 * rôles métier : COMMERCIAL, RH, PEDA…) mais n'est plus le mécanisme principal.
 */
export function authGuard(user: any, minPermission: Permission): void {
    if (!user) {
        throw new Error('Unauthorized: No valid session found');
    }

    const userLevel = PERMISSION_LEVEL[user.permission] ?? 0;
    const requiredLevel = PERMISSION_LEVEL[minPermission] ?? 0;

    if (userLevel >= requiredLevel) {
        return;
    }

    throw new Error('Forbidden: Insufficient permissions');
}

/**
 * Vérifie à la fois le niveau de permission ET l'appartenance à un rôle métier.
 * Exemple : authGuardRole(user, Permission.RESPONSABLE, JobRole.COMMERCIAL)
 *   → autorise tout user RESPONSABLE+, ET tout user COMMERCIAL (quel que soit son niveau).
 */
export function authGuardRole(user: any, minPermission: Permission, allowedJobRoles: string[]): void {
    if (!user) {
        throw new Error('Unauthorized: No valid session found');
    }

    const userLevel = PERMISSION_LEVEL[user.permission] ?? 0;
    const requiredLevel = PERMISSION_LEVEL[minPermission] ?? 0;

    // Permission suffisante → accès accordé
    if (userLevel >= requiredLevel) {
        return;
    }

    // Vérification par rôle métier si la permission est insuffisante
    if (allowedJobRoles.includes(user.role)) {
        return;
    }

    throw new Error('Forbidden: Insufficient permissions');
}
