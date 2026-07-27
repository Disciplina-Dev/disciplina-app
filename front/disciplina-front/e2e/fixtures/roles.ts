import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const stateDir = path.join(dir, '..', '.auth');

export const E2E_PASSWORD = 'E2ePassw0rd!';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

export interface RoleAccount {
    email: string;
    password: string;
    home: string;
}

export const ROLES = {
    commercial: { email: 'commercial@e2e.test', password: E2E_PASSWORD, home: '/commercial/portefeuille' },
    rh: { email: 'rh@e2e.test', password: E2E_PASSWORD, home: '/rh/candidats' },
    peda: { email: 'peda@e2e.test', password: E2E_PASSWORD, home: '/peda' },
    admin: { email: 'admin@e2e.test', password: E2E_PASSWORD, home: '/admin/utilisateurs' },
} satisfies Record<string, RoleAccount>;

export type RoleName = keyof typeof ROLES;

export const STORAGE_STATE: Record<RoleName, string> = {
    commercial: path.join(stateDir, 'commercial.json'),
    rh: path.join(stateDir, 'rh.json'),
    peda: path.join(stateDir, 'peda.json'),
    admin: path.join(stateDir, 'admin.json'),
};
