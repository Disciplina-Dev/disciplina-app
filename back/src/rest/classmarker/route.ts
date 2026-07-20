import express, { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { JobRole, Permission } from '../../types/user.types';
import { getClassMarkerLinks, MissingCredentialsError, ClassMarkerApiError } from './service';
import { logger } from '../../external/logger';

export const router: Router = express.Router();

router.get('/links', authenticate, async (req: AuthRequest, res: Response) => {
    const role = req.user?.role;
    const permission = req.user?.permission;
    if (role !== JobRole.RH && permission !== Permission.ADMIN && permission !== Permission.RESPONSABLE) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    try {
        const links = await getClassMarkerLinks();
        res.json({ links });
    } catch (err) {
        if (err instanceof MissingCredentialsError) {
            res.status(503).json({ error: err.message });
            return;
        }
        if (err instanceof ClassMarkerApiError) {
            res.status(502).json({ error: err.message });
            return;
        }
        logger.error(err, 'Unexpected ClassMarker error');
        res.status(500).json({ error: 'Internal error' });
    }
});
