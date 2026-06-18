import rateLimit from 'express-rate-limit';

export const emailRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 429, message: 'Too many requests, please try again later.' } },
});

export const relanceRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 429, message: 'Too many requests, please try again later.' } },
});

// Réservation publique : non authentifiée, donc plafonnée par IP.
export const bookingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 429, message: 'Trop de requêtes, réessayez plus tard.' } },
});
