import express, { Router } from 'express';
import { emargementRateLimiter } from '../middleware/rateLimiter';
import { resolveExternalRegion } from '../external/region';
import { formateurView, publicSigning, setAttendance, signByQr, signSheet } from './controller';

// Pages publiques de l'émargement : lien formateur et QR code alternant.
// Le jeton porte `<seanceId>.<hmac>:<region>` — le middleware route la requête
// vers la bonne base avant toute lecture.
export const router: Router = express.Router();

router.use(express.json({ limit: '3mb' }));
router.use(emargementRateLimiter);

const withRegion = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.params.signature = req.params.token;
    resolveExternalRegion(req, res, next);
};

router.get('/formateur/:token', withRegion, formateurView);
router.put('/formateur/:token/attendance', withRegion, setAttendance);
router.post('/formateur/:token/sign', withRegion, signSheet);

router.get('/sign/:token', withRegion, publicSigning);
router.post('/sign/:token', withRegion, signByQr);
