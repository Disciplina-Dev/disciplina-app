import express, { Router } from 'express';
import { login, register, generateGoogleUri, handleGoogleToken, disconnectGoogle } from './controller';
import { authenticate } from '../middleware/auth';

export const router: Router = express.Router();

router.post('/login', express.json(), login);
router.post('/register', express.json(), authenticate, register);
router.post('/google/uri', express.json(), authenticate, generateGoogleUri);
router.post('/google/token', express.json(), handleGoogleToken);
router.post('/google/disconnect', express.json(), authenticate, disconnectGoogle);
