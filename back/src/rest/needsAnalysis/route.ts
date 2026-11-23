import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRolesOrManager } from '../middleware/roleGuard';
import {
    downloadPdf,
    sendSignature,
    getMandatPdf,
    getCataloguePdf,
    getSignatureEmail,
    openAbDrive,
} from './controller';

export const router: Router = express.Router();

// Aperçu avant envoi en signature (PDF statiques + texte du mail).
// Déclaré avant `/:id/pdf` pour que « signature » ne soit pas pris pour un id.
router.get('/signature/mandat-pdf', authenticate, getMandatPdf);
router.get('/signature/catalogue-pdf', authenticate, getCataloguePdf);
router.get('/signature/email', authenticate, getSignatureEmail);

router.get('/:id/pdf', authenticate, downloadPdf);
// « Ouvrir l'AB dans le Drive » : redirige vers le PDF archivé (résolu à la demande si besoin).
// Lecture réservée aux commerciaux et aux RH (ou tout responsable/admin).
router.get('/:id/ab-drive', authenticate, requireRolesOrManager('COMMERCIAL', 'RH'), openAbDrive);
router.post('/:id/sign', authenticate, express.json({ limit: '2mb' }), sendSignature);
