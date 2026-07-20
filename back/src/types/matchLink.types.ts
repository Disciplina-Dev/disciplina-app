export enum MatchLinkStatus {
    PENDING = 'PENDING',
    AUTHENTICATED = 'AUTHENTICATED',
    COMPLETED = 'COMPLETED',
    LOCKED = 'LOCKED',
    // Jamais écrit : l'expiration se déduit de expires_at (MatchLinkService.isExpired).
    EXPIRED = 'EXPIRED',
}
