import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import {
    assiduite,
    assiduiteAlternant,
    create,
    exportAttendance,
    exportAttestation,
    exportGroupPdf,
    exportHistory,
    get,
    list,
    remove,
    resend,
    seancePdf,
    update,
    validate,
} from './controller';

export const router: Router = express.Router();

// La signature manuscrite est une image PNG en data-URL : plafond dédié.
router.use(express.json({ limit: '3mb' }));

const access = [authenticate, requireRoles('AD', 'GESTION', 'PEDA')];

router.get('/seances', ...access, list);
router.post('/seances', ...access, create);
router.get('/seances/:id', ...access, get);
router.put('/seances/:id', ...access, update);
router.delete('/seances/:id', ...access, remove);
router.post('/seances/:id/resend', ...access, resend);
router.post('/seances/:id/validate', ...access, validate);

// Exports (§8) : PDF de la feuille, présences/heures (CSV ou Excel), journal
// d'audit (CSV) et attestation d'assiduité. Mêmes droits que le reste du module.
router.get('/seances/:id/pdf', ...access, seancePdf);
router.get('/exports/attendance', ...access, exportAttendance);
router.get('/exports/history', ...access, exportHistory);
router.get('/attestations/:alternantId', ...access, exportAttestation);
router.get('/sessions/:sessionId/attendance.pdf', ...access, exportGroupPdf);

// Assiduité (7.1 / 7.2) : agrégats par alternant / session / site et fiche d'un
// alternant. Lecture seule, mêmes droits que le reste du module.
router.get('/assiduite', ...access, assiduite);
router.get('/assiduite/:alternantId', ...access, assiduiteAlternant);
