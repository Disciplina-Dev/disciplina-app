import { Request, Response } from 'express';
import { DriveService } from '../google/service/DriveService';
import { GoogleTokens } from '../google/types';

export async function handleListFiles(req: Request, res: Response): Promise<void> {
    try {
        if (!req.session.tokens) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const driveService = DriveService.fromTokens(req.session.tokens as GoogleTokens);
        const files = await driveService.listFiles();
        res.json(files);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}