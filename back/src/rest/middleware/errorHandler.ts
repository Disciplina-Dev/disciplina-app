import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
    logger.error({ err, method: req.method, url: req.url }, 'Unhandled error');
    const status = err.status ?? err.statusCode ?? 500;
    res.status(status).json({
        error: {
            code: status,
            message: err.message || 'Internal Server Error',
        },
    });
}
