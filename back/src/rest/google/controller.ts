import { Request, Response } from 'express';
import { getOAuth2Client, getAuthScopes } from './client';
import { GoogleTokens } from './types';

export async function handleAuth(req: Request, res: Response): Promise<void> {
    try {
        const oauth2Client = getOAuth2Client();
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: getAuthScopes(),
        });
        res.redirect(url);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
}

export async function handleCallback(req: Request, res: Response): Promise<void> {
    try {
        const { code } = req.query;
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code as string);
        req.session.tokens = tokens as GoogleTokens;
        res.redirect('http://localhost:5173/drive');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
}