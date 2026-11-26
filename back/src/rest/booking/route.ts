import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { bookingRateLimiter } from '../middleware/rateLimiter';
import {
    getMySettings,
    updateMySettings,
    getPublicBooking,
    getPublicSlots,
    postBooking,
    getDayBlocks,
    createDayBlock,
    releaseDayBlock,
    releaseDayBlockGroup,
    deleteDayBlock,
    deleteDayBlockGroup,
} from './controller';

export const router: Router = Router();

const access = [authenticate, requireRoles('AD', 'GESTION', 'RH')];

// Réglages (espace RH authentifié).
router.get('/settings', ...access, getMySettings);
router.put('/settings', express.json(), ...access, updateMySettings);

// Blocage de dates (espace RH authentifié) : période + portée (moi, mon secteur,
// tout le monde, ou une sélection de personnes).
router.get('/blocks', ...access, getDayBlocks);
router.post('/blocks', express.json(), ...access, createDayBlock);
// Périodes : routes déclarées avant /blocks/:id (deux segments, pas de conflit).
router.post('/blocks/groups/:groupKey/release', ...access, releaseDayBlockGroup);
router.delete('/blocks/groups/:groupKey', ...access, deleteDayBlockGroup);
router.post('/blocks/:id/release', ...access, releaseDayBlock);
router.delete('/blocks/:id', ...access, deleteDayBlock);

// Page publique (sans authentification), plafonnée par IP.
router.get('/public/:slug', bookingRateLimiter, getPublicBooking);
router.get('/public/:slug/slots', bookingRateLimiter, getPublicSlots);
router.post('/public/:slug/book', bookingRateLimiter, express.json(), postBooking);
