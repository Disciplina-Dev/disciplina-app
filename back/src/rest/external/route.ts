import express, { Router } from 'express';
import { externalRateLimiter } from '../middleware/rateLimiter';
import { requireExternalGuest } from './guard';
import { inspect, getProfile } from './controller';
import { sendCvImportMail, uploadCv } from './cvImport.controller';
import { sendCode, generate, regenerate } from './externalAccess.controller';
import { authenticate as authenticateStaff } from '../middleware/auth';

export const router: Router = express.Router();

router.use(express.json());

router.post('/generate', authenticateStaff, generate);

router.get('/:signature/inspect', externalRateLimiter, inspect);
router.post('/:signature/authenticate', externalRateLimiter, sendCode);
router.post('/:signature/regenerate', authenticateStaff, regenerate);

router.get('/:signature/profile', requireExternalGuest, getProfile);

router.post('/cv-import/send', externalRateLimiter, authenticateStaff, sendCvImportMail);
router.post(
    '/:signature/cv-upload',
    express.raw({ type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'], limit: '20mb' }),
    requireExternalGuest,
    uploadCv,
);
