import express, { Router } from 'express';
import { externalRateLimiter } from '../middleware/rateLimiter';
import { requireExternalGuest } from './guard';
import { inspect, authenticate, getProfile } from './controller';
import { sendCvImportMail } from './cvImport.controller';
import { authenticate as authenticateStaff } from '../middleware/auth';

export const router: Router = express.Router();

router.use(express.json());

router.get('/:signature/inspect', externalRateLimiter, inspect);
router.post('/:signature/authenticate', externalRateLimiter, authenticate);

router.get('/:signature/profile', requireExternalGuest, getProfile);

router.post('/cv-import/send', authenticateStaff, sendCvImportMail);
