import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { bookingRateLimiter } from '../middleware/rateLimiter';
import {
    getMySettings, updateMySettings,
    getPublicBooking, getPublicSlots, postBooking,
} from './controller';

export const router: Router = Router();

const access = [authenticate, requireRoles('ADMIN', 'RESPONSABLE', 'RH')];

// Réglages (espace RH authentifié).
router.get('/settings', ...access, getMySettings);
router.put('/settings', express.json(), ...access, updateMySettings);

// Page publique (sans authentification), plafonnée par IP.
router.get('/public/:slug', bookingRateLimiter, getPublicBooking);
router.get('/public/:slug/slots', bookingRateLimiter, getPublicSlots);
router.post('/public/:slug/book', bookingRateLimiter, express.json(), postBooking);
