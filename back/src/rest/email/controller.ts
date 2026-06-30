import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { GoogleTokens } from '../../external/google/types';

const userService = new UserService();
const gmailService = new GoogleGmailService();

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

export async function sendEmail(req: AuthRequest, res: Response): Promise<void> {
    await handleEmail(req, res, 'send');
}

export async function createDraft(req: AuthRequest, res: Response): Promise<void> {
    await handleEmail(req, res, 'draft');
}

async function handleEmail(req: AuthRequest, res: Response, mode: 'send' | 'draft'): Promise<void> {
    const { to, subject, body, attachments } = req.body;

    if (!to || !subject || !body) {
        res.status(400).json({ error: 'Champs manquants : to, subject, body' });
        return;
    }

    const user = await userService.findById(req.user.id);
    // refreshToken peut être null (Google ne le renvoie qu'au 1er consentement) :
    // un access_token suffit, comme pour le Drive.
    if (!user?.oauthToken) {
        res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
        return;
    }

    const options = {
        to,
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''),
        attachments,
    };
    const creds = { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined };

    try {
        if (mode === 'draft') {
            await gmailService.createDraft(creds, options, persistRefreshedTokens(user.id));
        } else {
            await gmailService.sendEmail(creds, options, persistRefreshedTokens(user.id));
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
