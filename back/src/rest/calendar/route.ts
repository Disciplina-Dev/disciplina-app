import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    listCalendarUsers,
    setAttendance,
    reportEvent,
} from './controller';

export const router: Router = Router();

const access = [authenticate, requireRoles('AD', 'GESTION', 'RH')];

router.get('/users', ...access, listCalendarUsers);
router.get('/events', ...access, getEvents);
router.post('/events', express.json(), ...access, createEvent);
router.patch('/events/:id', express.json(), ...access, updateEvent);
router.patch('/events/:id/attendance', express.json(), ...access, setAttendance);
router.patch('/events/:id/report', express.json(), ...access, reportEvent);
router.delete('/events/:id', ...access, deleteEvent);
