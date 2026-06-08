/**
 * Canonical log field schema — disciplina-api
 *
 * Request correlation:
 *   req.id             — UUID per HTTP request (pino-http genReqId)
 *
 * HTTP (OTel Semantic Conventions):
 *   http.method        — GET, POST, etc.
 *   http.url           — full path with query string
 *   http.status_code   — numeric response status
 *   http.request_id    — same as req.id, on response line
 *
 * Identity:
 *   user.id            — authenticated user's internal ID
 *   company.id         — company context when applicable
 *
 * Error (OTel Semantic Conventions):
 *   error.message      — err.message
 *   error.stack_trace  — err.stack (error/fatal only)
 *
 * Base (always present):
 *   service            — 'disciplina-api'
 *   env                — 'production' | 'development' | 'test'
 *   version            — package.json version
 */

import pino from 'pino';
import { env } from '../../config/env';
import { version } from '../../../package.json';

export const logger = pino(
    {
        level: env.LOG_LEVEL,

        base: {
            service: 'disciplina-api',
            env: env.NODE_ENV,
            version,
        },

        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                '*.password',
                '*.passwd',
                '*.currentPassword',
                '*.newPassword',
                '*.token',
                '*.accessToken',
                '*.refreshToken',
                '*.idToken',
                '*.secret',
                '*.apiKey',
                '*.api_key',
                '*.email',
                '*.phoneNumber',
                '*.phone',
                '*.ssn',
                '*.nationalId',
                '*.birthDate',
            ],
            censor: '[REDACTED]',
        },

        serializers: {
            err: (err: Error) => {
                const base = {
                    type: err.constructor.name,
                    'error.message': err.message,
                };
                if (logger.isLevelEnabled('error')) {
                    return { ...base, 'error.stack_trace': err.stack };
                }
                return base;
            },
        },
    },
    env.NODE_ENV !== 'production'
        ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
        : pino.destination(1), // fd 1 = stdout, unbuffered, 12-Factor compliant
);
