import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../../services/UserService';
import { googleOAuth } from '../../external/google/oauth-client';
import { signGoogleState, verifyGoogleState } from '../../external/crypto';
import { AuthRequest } from '../middleware/auth';
import { env } from '../../config/env';
import { logger } from '../../external/logger';
import { toUserResponse } from '../../services/mappers/user.mapper';
import { sanitizeSectors } from '../../utils/sector';

const userService = new UserService();

// Gestion des secteurs : réservée à l'admin et au responsable.
const SECTOR_MANAGER_ROLES = ['ADMIN', 'RESPONSABLE'];
// Rôles persistables assignables via la gestion des users.
const ASSIGNABLE_ROLES = ['ADMIN', 'RESPONSABLE', 'COMMERCIAL', 'RH', 'PEDA'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!SECTOR_MANAGER_ROLES.includes(req.user?.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const users = await userService.findAll();
        res.json(users.map(toUserResponse));
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: listUsers failed');
        res.status(500).json({ error: error.message });
    }
}

export async function updateUserSectors(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!SECTOR_MANAGER_ROLES.includes(req.user?.role)) {
            res.status(403).json({ error: 'Only admins and managers can edit sectors' });
            return;
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        const sectors = sanitizeSectors(req.body?.sectors);
        const user = await userService.updateSectors(id, sectors);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(toUserResponse(user));
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: updateUserSectors failed');
        res.status(400).json({ error: error.message });
    }
}

export async function login(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { email, passwordPlain } = req.body;
        if (!email || !passwordPlain) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        // Étape 1 : identifiants OK → un code 2FA est envoyé par email, aucune session délivrée.
        const { pendingToken } = await userService.login(email, passwordPlain);
        res.json({ requires2fa: true, pendingToken });
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: login failed');
        res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
}

/** Vérifie qu'un `pendingToken` est valide et de scope `2fa`, et renvoie l'id utilisateur. */
function parsePendingToken(pendingToken: unknown): number | null {
    if (typeof pendingToken !== 'string') return null;
    try {
        const payload = jwt.verify(pendingToken, env.JWT_SECRET) as { id?: number; scope?: string };
        if (payload.scope !== '2fa' || typeof payload.id !== 'number') return null;
        return payload.id;
    } catch {
        return null;
    }
}

export async function verifyTwoFactor(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { pendingToken, code } = req.body;
        if (!pendingToken || !code) {
            res.status(400).json({ error: 'Code requis' });
            return;
        }
        const userId = parsePendingToken(pendingToken);
        if (userId === null) {
            res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
            return;
        }
        const result = await userService.verifyTwoFactor(userId, String(code).trim());
        res.json({ token: result.token, user: toUserResponse(result.user) });
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: 2FA verify failed');
        res.status(401).json({ error: error.message || 'Code incorrect' });
    }
}

export async function resendTwoFactor(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = parsePendingToken(req.body?.pendingToken);
        if (userId === null) {
            res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
            return;
        }
        await userService.resendTwoFactor(userId);
        res.json({ success: true });
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: 2FA resend failed');
        res.status(500).json({ error: 'Échec de l\'envoi du code' });
    }
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can register new users' });
            return;
        }
        const { email, firstName, lastName, passwordPlain, role, sectors } = req.body;
        if (!email || !firstName || !lastName || !passwordPlain || !role) {
            res.status(400).json({ error: 'Missing required fields: email, firstName, lastName, passwordPlain, role' });
            return;
        }
        const user = await userService.register(email, firstName, lastName, passwordPlain, role, sectors);
        res.status(201).json(toUserResponse(user));
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can edit users' });
            return;
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }

        const { email, firstName, lastName, role, sectors, passwordPlain } = req.body ?? {};

        if (email !== undefined && !EMAIL_RE.test(String(email))) {
            res.status(400).json({ error: 'Invalid email' });
            return;
        }
        if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        if (passwordPlain !== undefined && String(passwordPlain).length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters' });
            return;
        }

        const user = await userService.updateUser(id, {
            email,
            firstName,
            lastName,
            role,
            sectors: sectors !== undefined ? sanitizeSectors(sectors) : undefined,
            passwordPlain,
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(toUserResponse(user));
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: updateUser failed');
        res.status(400).json({ error: error.message });
    }
}

export async function generateGoogleUri(req: AuthRequest, res: Response): Promise<void> {
    try {
        const targetUserId = req.body?.userId && req.user.role === 'ADMIN' ? req.body.userId : req.user.id;
        const state = signGoogleState(targetUserId);
        const url = googleOAuth.generateAuthUrl(state);
        res.json({ url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function disconnectGoogle(req: AuthRequest, res: Response): Promise<void> {
    try {
        await userService.updateGoogleTokens(req.user.id, null, null);
        const user = await userService.findById(req.user.id);
        res.json(user ? toUserResponse(user) : null);
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: google disconnect failed');
        res.status(500).json({ error: error.message });
    }
}

export async function handleGoogleToken(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { code, state } = req.body;
        if (!code || !state) {
            res.status(400).json({ error: 'Code and state are required' });
            return;
        }
        const result = verifyGoogleState(state);
        if (!result) {
            res.status(400).json({ error: 'Invalid state parameter' });
            return;
        }
        const tokens = await googleOAuth.exchangeCode(code);
        await userService.updateGoogleTokens(result.userId, tokens.access_token ?? null, tokens.refresh_token ?? null);
        const user = await userService.findById(result.userId);
        res.json(user ? toUserResponse(user) : null);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
