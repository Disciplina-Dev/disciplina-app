export enum Role {
    ADMIN = 'ADMIN',
    COMMERCIAL = 'COMMERCIAL',
    RH = 'RH'
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
