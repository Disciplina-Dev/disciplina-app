import { createHmac, timingSafeEqual } from 'crypto';

export class HmacService {
    sign(secret: string, payload: string): string {
        return createHmac('sha256', secret).update(payload).digest('hex');
    }

    verify(secret: string, payload: string, sig: string): boolean {
        const expected = this.sign(secret, payload);
        const expectedBuf = Buffer.from(expected);
        const sigBuf = Buffer.from(sig);
        if (expectedBuf.length !== sigBuf.length) return false;
        return timingSafeEqual(expectedBuf, sigBuf);
    }
}

export const hmac = new HmacService();
