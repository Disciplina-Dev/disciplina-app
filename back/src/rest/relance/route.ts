import express, { Router } from 'express';
import { sendRelance, handleResponse } from './controller';

export const router: Router = Router();

router.post('/api/relance/send', express.json(), sendRelance);
router.get('/api/relance/response', handleResponse);
