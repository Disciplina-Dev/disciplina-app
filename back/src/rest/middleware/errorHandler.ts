import { Request, Response, NextFunction } from 'express';
import { logger } from '../../external/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
    logger.error({ err, method: req.method, url: req.url }, 'Unhandled error');
    const status = err.status ?? err.statusCode ?? 500;
    // Un message de 5xx est écrit pour un développeur : il reste dans les logs.
    const message = status < 500 ? err.message || 'Bad Request' : 'Internal Server Error';
    res.status(status).json({
        error: {
            code: status,
            message,
        },
    });
}
