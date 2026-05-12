import express, { Router } from 'express';
import { login, register, linkDrive } from './controller';
import { authenticate } from '../middleware/auth';

export const router: Router = express.Router();

router.post('/login', express.json(), login);
router.post('/register', express.json(), authenticate, register);
router.post('/drive/link', express.json(), authenticate, linkDrive);
