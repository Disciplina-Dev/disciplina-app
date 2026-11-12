import express, { Router } from 'express';
import { authenticateAny } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { me } from './controller';

export const router: Router = express.Router();

// Le formateur est un contact externe : `authenticate()` le refuse partout
// ailleurs. Ici `authenticateAny()` ouvre la porte, `requireRoles('FORMATEUR')`
// la referme sur les seuls comptes d'intervenants.
const access = [authenticateAny, requireRoles('FORMATEUR')];

router.get('/me', ...access, me);
