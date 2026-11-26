import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles, requireRolesOrManager } from '../middleware/roleGuard';
import {
    list,
    listActive,
    get,
    create,
    update,
    duplicate,
    setStatus,
    remove,
    exportJson,
    invite,
    testRun,
    listAttempts,
    candidateAttempts,
    getAttempt,
    cancelAttempt,
    resendPdf,
    downloadPdf,
} from './controller';

export const router: Router = express.Router();

// Import JSON : 500 Ko max (README §8bis), validé ensuite question par question.
router.use(express.json({ limit: '500kb' }));

// Correcteur réservé au recrutement (Q11) : RH, ou permission ADMIN/RESPONSABLE.
const corrector = [authenticate, requireRolesOrManager('RH')];
// Suivi sur la fiche candidat : mêmes rôles que la lecture du score aujourd'hui.
const ficheReader = [authenticate, requireRoles('AD', 'GESTION', 'RH', 'PEDA', 'COMMERCIAL')];

router.get('/', ...corrector, list);
router.get('/active', ...corrector, listActive);
router.post('/', ...corrector, create);

router.get('/attempts', ...corrector, listAttempts);
router.get('/attempts/candidate/:candidateId', ...ficheReader, candidateAttempts);
router.get('/attempts/:attemptId', ...corrector, getAttempt);
router.post('/attempts/:attemptId/cancel', ...corrector, cancelAttempt);
router.post('/attempts/:attemptId/resend-pdf', ...corrector, resendPdf);
router.get('/attempts/:attemptId/pdf', ...corrector, downloadPdf);

router.get('/:id', ...corrector, get);
router.put('/:id', ...corrector, update);
router.delete('/:id', ...corrector, remove);
router.post('/:id/duplicate', ...corrector, duplicate);
router.post('/:id/status', ...corrector, setStatus);
router.get('/:id/export', ...corrector, exportJson);
router.post('/:id/invitations', ...corrector, invite);
router.post('/:id/test-run', ...corrector, testRun);
