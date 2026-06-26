import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { getDegrees, getClasses, createFolder } from './controller';

export const router: Router = Router();

const filizAccess = [authenticate, requireRoles('RH', 'RESPONSABLE', 'ADMIN')];

router.get('/degrees', ...filizAccess, getDegrees);
router.get('/classes', ...filizAccess, getClasses);
router.post('/folders', express.json(), ...filizAccess, createFolder);
