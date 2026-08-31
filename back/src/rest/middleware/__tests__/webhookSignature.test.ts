import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';
import { classmarkerWebhookGuard, yousignWebhookGuard, docusealWebhookGuard } from '../webhookSignature';

const SECRET = 'test-webhook-secret-32-bytes-min!';

function sign(secret: string, body: string, encoding: 'hex' | 'base64'): string {
    return createHmac('sha256', secret).update(body).digest(encoding);
}

function mockReq(body: Buffer | string, headers: Record<string, string> = {}): any {
    return { body: typeof body === 'string' ? Buffer.from(body) : body, headers };
}

function mockRes(): any {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

describe('classmarkerWebhookGuard', () => {
    it('calls next when no secret configured (dev bypass)', () => {
        const [, verifier] = classmarkerWebhookGuard(undefined);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('passes with a valid signature', () => {
        const [, verifier] = classmarkerWebhookGuard(SECRET);
        const body = JSON.stringify({ payload_status: 'live' });
        const sig = sign(SECRET, body, 'base64');
        const req = mockReq(body, { 'x-classmarker-hmac-sha256': sig });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature header is missing', () => {
        const [, verifier] = classmarkerWebhookGuard(SECRET);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature is wrong', () => {
        const [, verifier] = classmarkerWebhookGuard(SECRET);
        const req = mockReq('{}', { 'x-classmarker-hmac-sha256': 'invalidsignature==' });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 400 when body is invalid JSON', () => {
        const [, verifier] = classmarkerWebhookGuard(SECRET);
        const req = mockReq('not-json', { 'x-classmarker-hmac-sha256': 'any' });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('yousignWebhookGuard', () => {
    it('calls next when no secret configured (dev bypass)', () => {
        const [, verifier] = yousignWebhookGuard(undefined);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('passes with a valid sha256=<hex> signature', () => {
        const [, verifier] = yousignWebhookGuard(SECRET);
        const body = JSON.stringify({ eventName: 'signature_request.done' });
        const sig = `sha256=${sign(SECRET, body, 'hex')}`;
        const req = mockReq(body, { 'x-yousign-signature-256': sig });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('passes with a bare hex signature (no sha256= prefix)', () => {
        const [, verifier] = yousignWebhookGuard(SECRET);
        const body = '{}';
        const sig = sign(SECRET, body, 'hex');
        const req = mockReq(body, { 'x-yousign-signature-256': sig });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('rejects with 401 when signature header is missing', () => {
        const [, verifier] = yousignWebhookGuard(SECRET);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature is wrong', () => {
        const [, verifier] = yousignWebhookGuard(SECRET);
        const req = mockReq('{}', { 'x-yousign-signature-256': 'sha256=deadbeef' });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('docusealWebhookGuard', () => {
    // DocuSeal : header `timestamp.signature`, HMAC-SHA256 sur `${timestamp}.${rawBody}`, hex.
    function signDocuseal(secret: string, body: string, timestamp: number): string {
        const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
        return `${timestamp}.${sig}`;
    }

    it('calls next when no secret configured (dev bypass)', () => {
        const [, verifier] = docusealWebhookGuard(undefined);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('passes with a valid timestamp-prefixed signature', () => {
        const [, verifier] = docusealWebhookGuard(SECRET);
        const body = JSON.stringify({ event_type: 'submission.completed', data: { id: 42 } });
        const header = signDocuseal(SECRET, body, Math.floor(Date.now() / 1000));
        const req = mockReq(body, { 'x-docuseal-signature': header });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature header is missing', () => {
        const [, verifier] = docusealWebhookGuard(SECRET);
        const req = mockReq('{}');
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 401 when signature is wrong', () => {
        const [, verifier] = docusealWebhookGuard(SECRET);
        const req = mockReq('{}', { 'x-docuseal-signature': `${Math.floor(Date.now() / 1000)}.badsig` });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the header has no timestamp prefix', () => {
        const [, verifier] = docusealWebhookGuard(SECRET);
        const req = mockReq('{}', { 'x-docuseal-signature': 'badsig' });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects a stale timestamp beyond the tolerance window', () => {
        const [, verifier] = docusealWebhookGuard(SECRET);
        const body = '{}';
        const stale = signDocuseal(SECRET, body, Math.floor(Date.now() / 1000) - 10 * 60);
        const req = mockReq(body, { 'x-docuseal-signature': stale });
        const res = mockRes();
        const next = vi.fn();
        verifier(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});
