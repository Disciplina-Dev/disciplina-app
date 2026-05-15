import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../../services/UserService';
import { GoogleGmailService } from '../../external/google';

const userService = new UserService();
const gmailService = new GoogleGmailService();

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
        await gmailService.sendEmail(user.id, user.oauthToken, user.refreshToken, {
            to,
            subject,
            html: body,
            text: body.replace(/<[^>]*>/g, ''),
            attachment,
        });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
