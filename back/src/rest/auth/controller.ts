import { Response } from 'express';
import { google } from 'googleapis';
import { UserService } from '../../services/UserService';
import { getAuthScopes } from '../google/client';
import { signGoogleState, verifyGoogleState } from '../../utils/hmac';
import { env } from '../../config/env';
import { AuthRequest } from '../middleware/auth';

const CALLBACK_URL = 'http://localhost:5173/auth/google';

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
        const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, CALLBACK_URL);
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: getAuthScopes(),
            state,
        });
        res.json({ url });
    } catch (error: any) {
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
        const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, CALLBACK_URL);
        const { tokens } = await oauth2Client.getToken(code);
        await userService.updateGoogleTokens(result.userId, tokens.access_token || null, tokens.refresh_token || null);
        const user = await userService.findById(result.userId);
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
