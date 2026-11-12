import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FormateurService } from '../../services/FormateurService';
import { sendError } from '../shared/sendError';

const service = new FormateurService();

export async function list(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateurs: await service.list() });
    } catch (error) {
        sendError(res, error, 'Formateurs list failed');
    }
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.get(String(req.params.id)) });
    } catch (error) {
        sendError(res, error, 'Formateur fetch failed');
    }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ formateur: await service.create(req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur create failed');
    }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.update(String(req.params.id), req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur update failed');
    }
}

export async function addNote(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ formateur: await service.addNote(String(req.params.id), req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur note failed');
    }
}

export async function createAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ formateur: await service.createAccount(String(req.params.id), req.body, req.user.id) });
    } catch (error) {
        sendError(res, error, 'Formateur account creation failed');
    }
}

export async function resetAccountPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.resetAccountPassword(String(req.params.id), req.body, req.user.id) });
    } catch (error) {
        sendError(res, error, 'Formateur password reset failed');
    }
}

export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.deleteAccount(String(req.params.id), req.user.id) });
    } catch (error) {
        sendError(res, error, 'Formateur account deletion failed');
    }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(String(req.params.id), req.user.id);
        res.status(204).end();
    } catch (error) {
        sendError(res, error, 'Formateur deletion failed');
    }
}
