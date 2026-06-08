import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { logger } from '../../external/logger';

export const httpLogger = pinoHttp({
    logger,
    genReqId: () => randomUUID(),

    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    serializers: {
        req: (req) => ({
            'http.method': req.method,
            'http.url': req.url,
            'http.request_id': req.id,
        }),
        res: (res) => ({
            'http.status_code': res.statusCode,
        }),
    },

    redact: ['req.headers.authorization', 'req.headers.cookie'],
});
