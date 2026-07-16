import express, { Router } from 'express';
import {
    login,
    register,
    generateGoogleUri,
    handleGoogleToken,
    disconnectGoogle,
    listUsers,
    updateUserSectors,
    updateUser,
} from './controller';
import { authenticate } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';

export const router: Router = express.Router();

router.post('/login', loginRateLimiter, express.json(), login);
router.post('/register', loginRateLimiter, express.json(), authenticate, register);
router.get('/users', authenticate, listUsers);
router.patch('/users/:id/sectors', express.json(), authenticate, updateUserSectors);
router.patch('/users/:id', express.json(), authenticate, updateUser);
router.post('/google/uri', express.json(), authenticate, generateGoogleUri);
router.post('/google/token', express.json(), handleGoogleToken);
router.post('/google/disconnect', express.json(), authenticate, disconnectGoogle);
