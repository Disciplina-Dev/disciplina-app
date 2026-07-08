export enum MatchLinkStatus {
    PENDING = 'PENDING',
    AUTHENTICATED = 'AUTHENTICATED',
    COMPLETED = 'COMPLETED',
    LOCKED = 'LOCKED',
    EXPIRED = 'EXPIRED',
}

export interface MatchLink {
    signature: string;
    code: string;
    identifier: string;
    rhEmail: string;
    companyEmail: string;
    jobUuid: string;
    status: MatchLinkStatus;
    attempts: number;
    expiresAt: Date;
}
