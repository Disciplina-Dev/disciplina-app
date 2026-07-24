import express, { Request, Response, NextFunction } from 'express';
import { hmac } from '../../external/crypto';

type RawBodyParser = ReturnType<typeof express.raw>;
type VerifierFn = (req: Request, res: Response, next: NextFunction) => void;
type MiddlewarePair = [RawBodyParser, VerifierFn];

const IS_PROD = process.env.NODE_ENV === 'production';

// Ce qui distingue un webhook d'un autre : le header de signature, l'encodage du
// digest, et un éventuel préfixe à retirer (Yousign envoie `sha256=<hex>`).
interface WebhookGuardConfig {
    header: string;
    encoding: 'hex' | 'base64';
    stripPrefix?: string;
}

function rawJsonParser(): RawBodyParser {
    return express.raw({ type: 'application/json', limit: '256kb' });
}

function extractAndParseRawBody(req: Request, res: Response): string | null {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
    try {
        req.body = JSON.parse(raw || '{}');
    } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        return null;
    }
    return raw;
}

function makeWebhookGuard(config: WebhookGuardConfig) {
    return (secret: string | undefined): MiddlewarePair => [
        rawJsonParser(),
        (req: Request, res: Response, next: NextFunction): void => {
            const rawBody = extractAndParseRawBody(req, res);
            if (rawBody === null) return;
            if (!secret) {
                // Hors production, un secret absent ne bloque pas le développement.
                if (IS_PROD) {
                    res.status(500).json({ error: 'Webhook secret not configured' });
                    return;
                }
                next();
                return;
            }

            const header = req.headers[config.header] as string | undefined;
            if (!header) {
                res.status(401).json({ error: 'Missing webhook signature' });
                return;
            }

            const sig =
                config.stripPrefix && header.startsWith(config.stripPrefix)
                    ? header.slice(config.stripPrefix.length)
                    : header;
            if (!hmac.verify(secret, rawBody, sig, config.encoding)) {
                res.status(401).json({ error: 'Invalid webhook signature' });
                return;
            }
            next();
        },
    ];
}

export const classmarkerWebhookGuard = makeWebhookGuard({
    header: 'x-classmarker-hmac-sha256',
    encoding: 'base64',
});

export const yousignWebhookGuard = makeWebhookGuard({
    header: 'x-yousign-signature-256',
    encoding: 'hex',
    stripPrefix: 'sha256=',
});

export const docusealWebhookGuard = makeWebhookGuard({
    header: 'x-docuseal-signature',
    encoding: 'base64',
});
