import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { downloadPdf, sendSignature, getMandatPdf, getCataloguePdf, getSignatureEmail } from './controller';

export const router: Router = express.Router();

// Aperçu avant envoi en signature (PDF statiques + texte du mail).
// Déclaré avant `/:id/pdf` pour que « signature » ne soit pas pris pour un id.
router.get('/signature/mandat-pdf', authenticate, getMandatPdf);
router.get('/signature/catalogue-pdf', authenticate, getCataloguePdf);
router.get('/signature/email', authenticate, getSignatureEmail);

router.get('/:id/pdf', authenticate, downloadPdf);
router.post('/:id/sign', authenticate, express.json({ limit: '2mb' }), sendSignature);
