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
    const { to, subject, body, attachment } = req.body;

    if (!to || !subject || !body) {
        res.status(400).json({ error: 'Champs manquants : to, subject, body' });
        return;
    }

    const user = await userService.findById(req.user.id);
    if (!user?.oauthToken || !user?.refreshToken) {
        res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
        return;
    }

    try {
        await gmailService.sendEmail(
            { access_token: user.oauthToken, refresh_token: user.refreshToken },
            {
                to,
                subject,
                html: body,
                text: body.replace(/<[^>]*>/g, ''),
                attachment,
            },
            persistRefreshedTokens(user.id),
        );
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
