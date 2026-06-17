export enum Role {
    ADMIN = 'ADMIN',
    RESPONSABLE = 'RESPONSABLE',
    COMMERCIAL = 'COMMERCIAL',
    RH = 'RH',
}

export interface User {
    id: number;
    email: string;
    name: string;
    role: Role;
    sectors: string[] | null;
    oauthToken?: string | null;
    refreshToken?: string | null;
    password?: string;
}

export interface UserResponse {
    id: number;
    email: string;
    name: string;
    role: Role;
    sectors: string[] | null;
}
