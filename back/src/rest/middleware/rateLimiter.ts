import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

// Convention API : le corps d'erreur expose `error` sous forme de chaîne
// (le front lit `body.error` partout). Ne pas renvoyer d'objet ici.
const RATE_LIMIT_MESSAGE = { error: 'Trop de requêtes, réessayez plus tard.' };

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
    skip: () => env.E2E_DISABLE_LOGIN_RATE_LIMIT,
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
    message: RATE_LIMIT_MESSAGE,
});

// Choix de créneau candidat public (vérif signature / code) : non authentifié, plafonné par IP.
export const interviewRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

// Lien externe unifié (entreprises/candidats) : vérification signature + code.
export const externalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

// Réservation publique : non authentifiée, donc plafonnée par IP.
export const bookingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});

// Endpoint MCP (clé Bearer unique, accès lecture au CRM). Plafonné par IP en
// amont de la vérif de clé pour couper tout brute-force sur MCP_API_KEY.
export const mcpRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
});
