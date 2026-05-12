import { Response } from 'express';
import { UserService } from '../../services/UserService';
import { createOAuth2Client } from '../google/client';
import { env } from '../../config/env';
import { AuthRequest } from '../middleware/auth';

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

export async function linkDrive(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Authorization code is required' });
            return;
        }
        const oauth2Client = createOAuth2Client({
            clientId: env.GOOGLE_CLIENT_ID || '',
            clientSecret: env.GOOGLE_CLIENT_SECRET || '',
            redirectUri: 'postmessage',
        });
        const { tokens } = await oauth2Client.getToken(code);
        await userService.updateDriveTokens(
            req.user.id,
            tokens.access_token || null,
            tokens.refresh_token || null
        );
        const user = await userService.findById(req.user.id);
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
