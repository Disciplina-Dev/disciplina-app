import express, { Router } from 'express';
import { externalRateLimiter } from '../middleware/rateLimiter';
import { requireExternalGuest } from './guard';
import { inspect, getProfile } from './controller';
import { sendCvImportMail, uploadCv } from './cvImport.controller';
import { sendCode, generate, regenerate, inspectCode, complete, listAccess, revokeAccess } from './externalAccess.controller';
import {
    getCandidates,
    getCv,
    submitAnswers,
    getCompletion,
    requireMatchingReference,
} from './match.controller';
import { getSlots as getInterviewSlots, bookSlot as bookInterviewSlot, requireInterviewReference } from './interview.controller';
import { authenticate as authenticateStaff } from '../middleware/auth';

export const router: Router = express.Router();

router.use(express.json());

router.post('/generate', authenticateStaff, generate);
router.post('/inspect', externalRateLimiter, inspectCode);

// Gestion staff : lister et révoquer les accès externes.
router.get('/', authenticateStaff, listAccess);
router.post('/:signature/revoke', authenticateStaff, revokeAccess);

router.get('/:signature/inspect', externalRateLimiter, inspect);
router.post('/:signature/authenticate', externalRateLimiter, sendCode);
router.post('/:signature/completed', externalRateLimiter, requireExternalGuest, complete);
router.post('/:signature/regenerate', authenticateStaff, regenerate);

router.get('/:signature/profile', requireExternalGuest, getProfile);

// Session de matching (external_access, reference 2) — accès cookie EXTERNAL_GUEST.
router.get('/:signature/match/candidates', externalRateLimiter, requireExternalGuest, requireMatchingReference, getCandidates);
router.get('/:signature/match/cv/:candidateId', externalRateLimiter, requireExternalGuest, requireMatchingReference, getCv);
router.post('/:signature/match/answers', externalRateLimiter, requireExternalGuest, requireMatchingReference, submitAnswers);
router.get('/:signature/match/completion', externalRateLimiter, requireExternalGuest, requireMatchingReference, getCompletion);

// Session entretien (external_access, reference 3) — accès cookie EXTERNAL_GUEST.
router.get('/:signature/interview/slots', externalRateLimiter, requireExternalGuest, requireInterviewReference, getInterviewSlots);
router.post('/:signature/interview/book', externalRateLimiter, requireExternalGuest, requireInterviewReference, bookInterviewSlot);

router.post('/cv-import/send', externalRateLimiter, authenticateStaff, sendCvImportMail);
router.post(
    '/:signature/cv-upload',
    express.raw({ type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'], limit: '20mb' }),
    requireExternalGuest,
    uploadCv,
);
