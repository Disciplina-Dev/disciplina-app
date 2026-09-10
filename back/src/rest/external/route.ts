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
import { resolveExternalRegion } from './region';

export const router: Router = express.Router();

// Mail d'import CV : le corps porte la signature en data URL + les pièces
// jointes en base64, donc bien au-delà des 100kb par défaut. Déclaré AVANT le
// express.json() du router : sinon le parser 100kb rejette la requête (413)
// avant que celui de la route ne soit atteint.
router.post('/cv-import/send', express.json({ limit: '50mb' }), externalRateLimiter, authenticateStaff, sendCvImportMail);

router.use(express.json());

router.post('/generate', authenticateStaff, generate);
router.post('/inspect', externalRateLimiter, resolveExternalRegion, inspectCode);

// Gestion staff : lister et révoquer les accès externes.
router.get('/', authenticateStaff, listAccess);
router.post('/:signature/revoke', authenticateStaff, revokeAccess);

router.get('/:signature/inspect', externalRateLimiter, resolveExternalRegion, inspect);
router.post('/:signature/authenticate', externalRateLimiter, resolveExternalRegion, sendCode);
router.post('/:signature/completed', externalRateLimiter, resolveExternalRegion, requireExternalGuest, complete);
router.post('/:signature/regenerate', authenticateStaff, regenerate);

router.get('/:signature/profile', resolveExternalRegion, requireExternalGuest, getProfile);

// Session de matching (external_access, reference 2) — accès cookie EXTERNAL_GUEST.
router.get(
    '/:signature/match/candidates',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireMatchingReference,
    getCandidates,
);
router.get(
    '/:signature/match/cv/:candidateId',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireMatchingReference,
    getCv,
);
router.post(
    '/:signature/match/answers',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireMatchingReference,
    submitAnswers,
);
router.get(
    '/:signature/match/completion',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireMatchingReference,
    getCompletion,
);

// Session entretien (external_access, reference 3) — accès cookie EXTERNAL_GUEST.
router.get(
    '/:signature/interview/slots',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireInterviewReference,
    getInterviewSlots,
);
router.post(
    '/:signature/interview/book',
    externalRateLimiter,
    resolveExternalRegion,
    requireExternalGuest,
    requireInterviewReference,
    bookInterviewSlot,
);

router.post('/cv-import/send', externalRateLimiter, authenticateStaff, sendCvImportMail);
router.post(
    '/:signature/cv-upload',
    express.raw({ type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'], limit: '20mb' }),
    resolveExternalRegion,
    requireExternalGuest,
    uploadCv,
);
