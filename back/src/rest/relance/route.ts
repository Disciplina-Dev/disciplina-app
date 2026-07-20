import express, { Router } from 'express';
import {
    sendRelance,
    sendBulkRelance,
    handleResponse,
    sendCompanyMailRelance,
    completePhoneRelance,
    getCompanyRelanceHistory,
} from './controller';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';

export const router: Router = Router();

// Relance candidats : réservée aux profils RH (les routes company gardent leur guard interne).
router.post('/api/relance/send', express.json(), authenticate, requireRoles('AD', 'GESTION', 'RH'), sendRelance);
// Envoi groupé d'un modèle de mail RH (PJ possible → limite élargie).
router.post(
    '/api/relance/bulk',
    express.json({ limit: '50mb' }),
    authenticate,
    requireRoles('AD', 'GESTION', 'RH'),
    sendBulkRelance,
);
router.get('/api/relance/response', handleResponse);

// Relances entreprise (commercial) : mail / téléphone + historique.
router.post('/api/relance/company/:id/mail', express.json({ limit: '50mb' }), authenticate, sendCompanyMailRelance);
router.post('/api/relance/company/:id/phone', express.json(), authenticate, completePhoneRelance);
router.get('/api/relance/company/:id/history', authenticate, getCompanyRelanceHistory);
