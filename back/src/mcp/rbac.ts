import { hasMinPermission } from '../graphql/authGuard';
import { JobRole, Permission } from '../types/user.types';
import type { McpUser } from './types';

export const PERMISSION_DENIED_MSG =
    'Accès refusé : vos droits (rôle/permission) ne permettent pas d\u2019utiliser cet outil.';

/**
 * Exigence d'accès pour un outil MCP : miroir de `authGuardRole` du GraphQL
 * (Permission hiérarchique OU appartenance à un rôle métier). Un outil est
 * déclaré avec le scope minimal requis à sa registration.
 */
export interface McpToolScope {
    minPermission: Permission;
    allowedRoles: JobRole[];
}

export function mcpToolScope(minPermission: Permission, allowedRoles: JobRole[]): McpToolScope {
    return { minPermission, allowedRoles };
}

/** Retourne un message de refus si l'utilisateur n'a pas le scope requis, sinon null. */
export function checkToolScope(user: McpUser | undefined, scope: McpToolScope): string | null {
    if (!user) return PERMISSION_DENIED_MSG;
    if (hasMinPermission(user, scope.minPermission)) return null;
    if (scope.allowedRoles.includes(user.role)) return null;
    return PERMISSION_DENIED_MSG;
}