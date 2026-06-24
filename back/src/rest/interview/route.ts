import express, { Router } from 'express';
import { interviewRateLimiter } from '../middleware/rateLimiter';
import { requireInterviewGuest } from './guard';
import { inspect, authenticate, getSlots, bookSlot } from './controller';

export const router: Router = express.Router();

router.use(express.json());

router.get('/:signature/inspect', interviewRateLimiter, inspect);
router.post('/:signature/authenticate', interviewRateLimiter, authenticate);

router.get('/:signature/slots', requireInterviewGuest, getSlots);
router.post('/:signature/book', requireInterviewGuest, bookSlot);
