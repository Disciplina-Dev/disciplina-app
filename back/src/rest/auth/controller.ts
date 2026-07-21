import { Response } from 'express';
import { UserService, roleToId, permissionToId } from '../../services/UserService';
import { googleOAuth } from '../../external/google/oauth-client';
import { signGoogleState, verifyGoogleState } from '../../external/crypto';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import { toUserResponse, toDirectoryEntry } from '../../services/mappers/user.mapper';
import { sanitizeSectors } from '../../utils/sector';
import { isValidEmail } from '../../services/validation';
import { JobRole, Permission } from '../../types/user.types';

const userService = new UserService();

// Gestion des secteurs : réservée à l'admin et au responsable.
const SECTOR_MANAGER_PERMISSIONS: Permission[] = [Permission.ADMIN, Permission.RESPONSABLE];
// Rôles persistables assignables via la gestion des users.
const ASSIGNABLE_JOB_ROLES: JobRole[] = [JobRole.COMMERCIAL, JobRole.RH, JobRole.PEDA, JobRole.AD, JobRole.GESTION];
const ASSIGNABLE_PERMISSIONS: Permission[] = [Permission.EMPLOYEE, Permission.RESPONSABLE, Permission.ADMIN];

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!SECTOR_MANAGER_PERMISSIONS.includes(req.user?.permission)) {
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

// Annuaire d'affichage, ouvert à tout le staff : résoudre un id en nom + rôle est
// nécessaire dans le portefeuille et les dashboards, que listUsers ne sert pas.
export async function listDirectory(_req: AuthRequest, res: Response): Promise<void> {
    try {
        const users = await userService.findAll();
        res.json(users.map(toDirectoryEntry));
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: listDirectory failed');
        res.status(500).json({ error: 'Internal error' });
    }
}

export async function updateUserSectors(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!SECTOR_MANAGER_PERMISSIONS.includes(req.user?.permission)) {
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
        const result = await userService.login(email, passwordPlain);
        res.json({ token: result.token, user: toUserResponse(result.user) });
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: login failed');
        res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (req.user?.permission !== Permission.ADMIN) {
            res.status(403).json({ error: 'Only admins can register new users' });
            return;
        }
        const { email, firstName, lastName, passwordPlain, role, permission, sectors } = req.body;
        if (!email || !firstName || !lastName || !passwordPlain || !role || !permission) {
            res.status(400).json({
                error: 'Missing required fields: email, firstName, lastName, passwordPlain, role, permission',
            });
            return;
        }
        const roleId = roleToId(role as JobRole);
        const permissionId = permissionToId(permission as Permission);
        const user = await userService.register(
            email,
            firstName,
            lastName,
            passwordPlain,
            roleId,
            permissionId,
            sectors,
        );
        res.status(201).json(toUserResponse(user));
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (req.user?.permission !== Permission.ADMIN) {
            res.status(403).json({ error: 'Only admins can edit users' });
            return;
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }

        const { email, firstName, lastName, role, permission, sectors, passwordPlain } = req.body ?? {};

        if (email !== undefined && !isValidEmail(email)) {
            res.status(400).json({ error: 'Invalid email' });
            return;
        }
        if (role !== undefined && !ASSIGNABLE_JOB_ROLES.includes(role)) {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        if (permission !== undefined && !ASSIGNABLE_PERMISSIONS.includes(permission)) {
            res.status(400).json({ error: 'Invalid permission' });
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
            permission,
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
        const targetUserId =
            req.body?.userId && req.user.permission === Permission.ADMIN ? req.body.userId : req.user.id;
        const state = signGoogleState(targetUserId);
        const url = googleOAuth.generateAuthUrl(state);
        res.json({ url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

// État de la liaison Google du user courant. `connected: false` couvre les deux
// cas : jamais connecté, ou refresh_token purgé après un `invalid_grant` détecté
// lors d'un appel réel (cf. GoogleOAuthClient.forCredentials).
export async function googleStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
        const user = await userService.findById(req.user.id);
        res.json({ connected: Boolean(user?.oauthToken && user?.refreshToken) });
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: googleStatus failed');
        res.status(500).json({ error: 'Internal error' });
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
