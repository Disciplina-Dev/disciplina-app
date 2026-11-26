import express, { Router } from 'express';
import { questionnaireRateLimiter } from '../middleware/rateLimiter';
import { resolveExternalRegion } from '../external/region';
import { getState, start, answer, visibility } from './public.controller';

// Page candidat publique (/test/:token) : sans compte, jeton `<secret>:<region>`.
export const router: Router = express.Router();

router.use(express.json({ limit: '10kb' }));
router.use(questionnaireRateLimiter);

const withRegion = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.params.signature = req.params.token;
    resolveExternalRegion(req, res, next);
};

router.get('/:token', withRegion, getState);
router.post('/:token/start', withRegion, start);
router.post('/:token/answer', withRegion, answer);
router.post('/:token/visibility', withRegion, visibility);
