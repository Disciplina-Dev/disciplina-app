import type { JobRole, Permission } from '../types/user.types';
import type { Region } from '../types/tenant';

/**
 * Contexte d'authentification porté par chaque requête MCP : l'utilisateur CRM
 * (résolu par requête depuis la table `users` de la région) derrière un access
 * token OAuth, ou un contexte admin synthétique pour la clé MCP statique.
 * Sert au routing multi-tenant (syncWithRegion) et au RBAC par outil.
 */
export interface McpUser {
    id: number;
    role: JobRole;
    permission: Permission;
    sectors: string[] | null;
    region: Region;
}