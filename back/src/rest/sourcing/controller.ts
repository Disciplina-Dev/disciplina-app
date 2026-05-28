import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SireneService } from '../../external/insee/sirene.service';

const sireneService = new SireneService();

export async function checkSiret(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { siret } = req.params;
        const result = await sireneService.checkSiret(siret);
        res.json(result);
    } catch (error: any) {
        if (error.message === 'SIRET not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message === 'Rate limit exceeded') {
            res.status(429).json({ error: error.message });
            return;
        }
        res.status(400).json({ error: error.message });
    }
}
