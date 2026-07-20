export enum InterviewAccessStatus {
    PENDING = 'PENDING',
    AUTHENTICATED = 'AUTHENTICATED',
    COMPLETED = 'COMPLETED',
    LOCKED = 'LOCKED',
    // Jamais écrit : l'expiration se déduit de expires_at (InterviewAccessService.isExpired).
    EXPIRED = 'EXPIRED',
}
