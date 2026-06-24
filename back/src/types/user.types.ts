export enum Role {
    ADMIN = 'ADMIN',
    RESPONSABLE = 'RESPONSABLE',
    COMMERCIAL = 'COMMERCIAL',
    RH = 'RH',
    // Rôle non persistant : vit uniquement dans le JWT d'une session de portail entreprise (match_link).
    ENTREPRISE_GUEST = 'ENTREPRISE_GUEST',
    // Rôle non persistant : vit uniquement dans le JWT d'une session de choix de créneau candidat (interview_access).
    CANDIDATE_GUEST = 'CANDIDATE_GUEST',
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
    googleConnected: boolean;
}
