import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FormateurService } from '../../services/FormateurService';
import { sendError } from '../shared/sendError';

const service = new FormateurService();

/**
 * Espace formateur. Toutes les lectures sont résolues par `req.user.id` — le
 * compte de connexion —, jamais par un identifiant d'URL : un formateur ne peut
 * donc pas consulter les données d'un autre, même en forgeant l'appel.
 */
export async function me(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json(await service.dashboardForUser(req.user.id));
    } catch (error) {
        sendError(res, error, 'Formateur dashboard failed');
    }
}
