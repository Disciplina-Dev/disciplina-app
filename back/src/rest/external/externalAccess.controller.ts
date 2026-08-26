import { Request, Response } from 'express';
import { ExternalAccessService } from '../../services/ExternalAccessService';

const externalAccessService = new ExternalAccessService();

export async function sendCode(req: Request, res: Response): Promise<void> {
    const { signature } = req.params;
    if (!signature) {
        res.status(400).json({ error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.sendCode(signature);
    res.status(result.httpCode).json({ message: result.message });
}
