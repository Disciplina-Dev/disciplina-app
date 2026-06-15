import { Response } from 'express';
import { UserService } from '../../services/UserService';
import { googleOAuth } from '../../external/google/oauth-client';
import { signGoogleState, verifyGoogleState } from '../../external/crypto';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';

const userService = new UserService();

export async function login(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { email, passwordPlain } = req.body;
        if (!email || !passwordPlain) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        const result = await userService.login(email, passwordPlain);
        res.json(result);
    } catch (error: any) {
        logger.error({ err: error }, 'Auth: login failed');
        res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can register new users' });
            return;
        }
        const { email, name, passwordPlain, role, sectors } = req.body;
        if (!email || !name || !passwordPlain || !role) {
            res.status(400).json({ error: 'Missing required fields: email, name, passwordPlain, role' });
            return;
        }
        const user = await userService.register(email, name, passwordPlain, role, sectors);
        res.status(201).json(user);
    } catch (error: any) {
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
        res.json(user);
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
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
