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
    jobUuid: string;
    candidateId: string;
    rhEmail: string;
    status: InterviewAccessStatus;
    attempts: number;
    expiresAt: Date;
}
