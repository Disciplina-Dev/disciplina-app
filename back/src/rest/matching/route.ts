import { Router } from 'express';
import { handleMatchResponse } from './controller';

export const router: Router = Router();

router.get('/api/matching/response', handleMatchResponse);
