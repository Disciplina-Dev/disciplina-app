import rateLimit from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { error: { code: 429, message: 'Too many requests, please try again later.' } };

export const emailRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

export const relanceRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

export const graphqlRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

// Portail entreprise public (vérif signature / code) : non authentifié, plafonné par IP.
export const matchRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 429, message: 'Trop de requêtes, réessayez plus tard.' } },
});

// Réservation publique : non authentifiée, donc plafonnée par IP.
export const bookingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 429, message: 'Trop de requêtes, réessayez plus tard.' } },
});
