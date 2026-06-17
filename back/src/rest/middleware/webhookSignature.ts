import { createHmac, timingSafeEqual } from 'crypto';
import express, { Request, Response, NextFunction } from 'express';

type RawBodyParser = ReturnType<typeof express.raw>;
type VerifierFn = (req: Request, res: Response, next: NextFunction) => void;
type MiddlewarePair = [RawBodyParser, VerifierFn];

const IS_PROD = process.env.NODE_ENV === 'production';

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

function timingSafeStringEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
}

function hmacDigest(secret: string, payload: string, encoding: 'hex' | 'base64'): string {
    return createHmac('sha256', secret).update(payload).digest(encoding);
}

function guardMissingSecret(res: Response, next: NextFunction): void {
    if (IS_PROD) {
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }
    next();
}

export function classmarkerWebhookGuard(secret: string | undefined): MiddlewarePair {
    return [
        rawJsonParser(),
        (req: Request, res: Response, next: NextFunction): void => {
            const rawBody = extractAndParseRawBody(req, res);
            if (rawBody === null) return;
            if (!secret) {
                guardMissingSecret(res, next);
                return;
            }

            const sig = req.headers['x-classmarker-hmac-sha256'] as string | undefined;
            if (!sig) {
                res.status(401).json({ error: 'Missing webhook signature' });
                return;
            }

            const expected = hmacDigest(secret, rawBody, 'base64');
            if (!timingSafeStringEqual(sig, expected)) {
                res.status(401).json({ error: 'Invalid webhook signature' });
                return;
            }
            next();
        },
    ];
}

export function yousignWebhookGuard(secret: string | undefined): MiddlewarePair {
    return [
        rawJsonParser(),
        (req: Request, res: Response, next: NextFunction): void => {
            const rawBody = extractAndParseRawBody(req, res);
            if (rawBody === null) return;
            if (!secret) {
                guardMissingSecret(res, next);
                return;
            }

            const sigHeader = req.headers['x-yousign-signature-256'] as string | undefined;
            if (!sigHeader) {
                res.status(401).json({ error: 'Missing webhook signature' });
                return;
            }

            const sig = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader;
            const expected = hmacDigest(secret, rawBody, 'hex');
            if (!timingSafeStringEqual(sig, expected)) {
                res.status(401).json({ error: 'Invalid webhook signature' });
                return;
            }
            next();
        },
    ];
}

export function docusealWebhookGuard(secret: string | undefined): MiddlewarePair {
    return [
        rawJsonParser(),
        (req: Request, res: Response, next: NextFunction): void => {
            const rawBody = extractAndParseRawBody(req, res);
            if (rawBody === null) return;
            if (!secret) {
                guardMissingSecret(res, next);
                return;
            }

            const sig = req.headers['x-docuseal-signature'] as string | undefined;
            if (!sig) {
                res.status(401).json({ error: 'Missing webhook signature' });
                return;
            }

            const expected = hmacDigest(secret, rawBody, 'base64');
            if (!timingSafeStringEqual(sig, expected)) {
                res.status(401).json({ error: 'Invalid webhook signature' });
                return;
            }
            next();
        },
    ];
}
