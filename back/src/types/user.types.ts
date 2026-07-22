export enum JobRole {
    COMMERCIAL = 'COMMERCIAL',
    RH = 'RH',
    PEDA = 'PEDA',
    AD = 'AD',
    GESTION = 'GESTION',
}

export enum Permission {
    EMPLOYEE = 'EMPLOYEE',
    RESPONSABLE = 'RESPONSABLE',
    ADMIN = 'ADMIN',
}

// Rôles JWT-only : vivent uniquement dans le JWT, jamais persistés en base.
export enum GuestRole {
    ENTREPRISE_GUEST = 'ENTREPRISE_GUEST',
    CANDIDATE_GUEST = 'CANDIDATE_GUEST',
    EXTERNAL_GUEST = 'EXTERNAL_GUEST',
}

export interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: JobRole;
    permission: Permission;
    sectors: string[] | null;
    oauthToken?: string | null;
    refreshToken?: string | null;
    password?: string;
}

export interface UserResponse {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: JobRole;
    permission: Permission;
    sectors: string[] | null;
    googleConnected: boolean;
}

export interface DirectoryEntry {
    id: number;
    firstName: string;
    lastName: string;
    role: JobRole;
    permission: Permission;
}
