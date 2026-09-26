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
    // DocuSeal : header `timestamp.signature`, HMAC portant sur
    // `${timestamp}.${rawBody}` (cf. docuseal.com/resources/use-webhooks).
    // timestampToleranceSeconds = fenêtre de rejeu (seconds) ; absente = pas de contrôle.
    timestampPrefixed?: boolean;
    timestampToleranceSeconds?: number;
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

            let sig = header;
            let payload = rawBody;
            if (config.timestampPrefixed) {
                const [timestamp, signature] = header.split('.', 2);
                if (!signature) {
                    res.status(401).json({ error: 'Invalid webhook signature' });
                    return;
                }
                if (config.timestampToleranceSeconds !== undefined) {
                    const ts = Number(timestamp);
                    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > config.timestampToleranceSeconds) {
                        res.status(401).json({ error: 'Invalid webhook signature' });
                        return;
                    }
                }
                sig = signature;
                payload = `${timestamp}.${rawBody}`;
            } else if (config.stripPrefix && header.startsWith(config.stripPrefix)) {
                sig = header.slice(config.stripPrefix.length);
            }
            if (!hmac.verify(secret, payload, sig, config.encoding)) {
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
    encoding: 'hex',
    timestampPrefixed: true,
    timestampToleranceSeconds: 300,
});
