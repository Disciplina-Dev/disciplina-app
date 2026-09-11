import { NextFunction, Request, Response } from 'express';
import { regionFromExternalSignature, syncWithRegion } from '../../db/tenant';

/**
 * Route tout le flux guest des liens externes vers la bonne région (MySQL/Mongo)
 * à partir de la région embarquée dans la signature (`<sig>:<region>`). Les liens
 * legacy sans suffixe retombent sur le tenant par défaut. Sans ce middleware, les
 * liens créés côté Annemasse étaient cherchés dans la base Réunion.
 */
export function resolveExternalRegion(req: Request, res: Response, next: NextFunction): void {
    const signature = req.params?.signature ?? (req.body?.signature as string | undefined);
    if (!signature) {
        next();
        return;
    }
    syncWithRegion(regionFromExternalSignature(signature), () => next());
}