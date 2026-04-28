import express, { Router } from 'express';
import { handleAuth, handleCallback } from './controller';

export const router: Router = express.Router();

router.get('/auth/google', handleAuth);
router.get('/auth/callback', handleCallback);