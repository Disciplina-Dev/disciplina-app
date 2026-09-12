import { AsyncLocalStorage } from 'node:async_hooks';
import type { McpUser } from './types';

// Contexte MCP par requête : porté par AsyncLocalStorage, posé par la route
// autour du traitement JSON-RPC. readTool y lit l'utilisateur courant pour
// appliquer le RBAC avant chaque appel d'outil (thread-safe : chaque requête a
// son propre contexte, indépendant de celui de la région).
const mcpUserStorage = new AsyncLocalStorage<McpUser | undefined>();

export function runWithMcpUser<T>(user: McpUser | undefined, fn: () => T): T {
    return mcpUserStorage.run(user, fn);
}

export function currentMcpUser(): McpUser | undefined {
    return mcpUserStorage.getStore();
}