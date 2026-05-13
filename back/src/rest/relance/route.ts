import express, { Router } from 'express';
import { sendRelance, handleResponse } from './controller';
import { authenticate } from '../middleware/auth';

export const router: Router = Router();

router.post('/api/relance/send', express.json(), authenticate, sendRelance);
router.get('/api/relance/response', handleResponse);
