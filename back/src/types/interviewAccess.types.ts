export enum InterviewAccessStatus {
    PENDING = 'PENDING',
    AUTHENTICATED = 'AUTHENTICATED',
    COMPLETED = 'COMPLETED',
    LOCKED = 'LOCKED',
    EXPIRED = 'EXPIRED',
}

export interface InterviewAccess {
    signature: string;
    code: string;
    offerUuid: string;
    candidateId: string;
    rhEmail: string;
    status: InterviewAccessStatus;
    attempts: number;
    expiresAt: Date;
}
