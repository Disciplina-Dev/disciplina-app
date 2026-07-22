import express, { Router } from 'express';
import { externalRateLimiter } from '../middleware/rateLimiter';
import { requireExternalGuest } from './guard';
import { inspect, authenticate, getProfile } from './controller';

export const router: Router = express.Router();

router.use(express.json());

router.get('/:signature/inspect', externalRateLimiter, inspect);
router.post('/:signature/authenticate', externalRateLimiter, authenticate);

router.get('/:signature/profile', requireExternalGuest, getProfile);
