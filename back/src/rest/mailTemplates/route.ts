import express, { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import {
    listTemplates, createTemplate, updateTemplate, deleteTemplate,
    uploadAttachment, deleteAttachment, resolveAttachment,
    getSignature, putSignature, deleteSignature,
} from './controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const router: Router = Router();

const access = [authenticate, requireRoles('ADMIN', 'RESPONSABLE', 'RH', 'COMMERCIAL', 'PEDA')];
const json = express.json({ limit: '2mb' });

// Signature (une par user + scope) — déclarée avant '/:id' pour ne pas être captée comme un id.
router.get('/signature', ...access, getSignature);
router.put('/signature', ...access, upload.single('file'), putSignature);
router.delete('/signature', ...access, deleteSignature);

// Modèles
router.get('/', ...access, listTemplates);
router.post('/', ...access, json, createTemplate);
router.put('/:id', ...access, json, updateTemplate);
router.delete('/:id', ...access, deleteTemplate);

// Pièce jointe (1 par modèle)
router.post('/:id/attachment', ...access, upload.single('file'), uploadAttachment);
router.get('/:id/attachment', ...access, resolveAttachment);
router.delete('/:id/attachment', ...access, deleteAttachment);
