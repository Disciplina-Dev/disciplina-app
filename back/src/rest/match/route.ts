import express, { Router } from 'express';
import { matchRateLimiter } from '../middleware/rateLimiter';
import { requireMatchGuest } from './guard';
import { inspect, regenerate, authenticate, getCandidates, getCv, submitAnswers, getCompletion } from './controller';

export const router: Router = express.Router();

router.use(express.json());

router.get('/:signature/inspect', matchRateLimiter, inspect);
router.post('/:signature/regenerate', matchRateLimiter, regenerate);
router.post('/:signature/authenticate', matchRateLimiter, authenticate);

router.get('/:signature/candidates', requireMatchGuest, getCandidates);
router.get('/:signature/cv/:candidateId', requireMatchGuest, getCv);
router.post('/:signature/answers', requireMatchGuest, submitAnswers);
router.get('/:signature/completion', requireMatchGuest, getCompletion);
