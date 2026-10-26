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

// Page candidat des questionnaires internes : non authentifiée, plafonnée par IP
// (anti-rejeu massif). Large : une salle entière passe souvent derrière la même IP (wifi),
// et l'énumération est vaine sur un jeton aléatoire de 256 bits.
export const questionnaireRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
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

// Saisie des identifiants sur la page de consentement OAuth MCP (POST /authorize) :
// vecteur de brute-force du mot de passe CRM (RGPD Art. 32). Seuls les échecs comptent
// (succès = 302) ; le plafond du SDK (100 / 15 min) est trop lâche pour un mot de passe.
const consentLimiterBase = {
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req: unknown, res: { statusCode: number }) => res.statusCode === 302,
    message: RATE_LIMIT_MESSAGE,
    skip: () => env.E2E_DISABLE_LOGIN_RATE_LIMIT,
};

/** Par IP : coupe le brute-force depuis une source. */
export const mcpConsentIpLimiter = rateLimit(consentLimiterBase);

/**
 * Par compte (e-mail + région), toutes IP confondues : coupe le brute-force distribué.
 * Contrepartie assumée : quelqu'un peut verrouiller 15 min la connexion MCP d'un collègue.
 */
export const mcpConsentAccountLimiter = rateLimit({
    ...consentLimiterBase,
    keyGenerator: (req) => {
        const body = (req.body ?? {}) as { email?: unknown; region?: unknown };
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const region = typeof body.region === 'string' ? body.region : '';
        return `mcp-consent:${region}:${email}`;
    },
    validate: { keyGeneratorIpFallback: false },
});
