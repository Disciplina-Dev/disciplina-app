import express, { Router } from 'express';
import { handleListFiles } from './controller';

export const router: Router = express.Router();

router.get('/', handleListFiles);