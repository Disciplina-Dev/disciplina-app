import { createHmac } from 'crypto';

export class HmacService {
    sign(secret: string, payload: string): string {
        return createHmac('sha256', secret).update(payload).digest('hex');
    }

    verify(secret: string, payload: string, sig: string): boolean {
        const expected = this.sign(secret, payload);
        return expected === sig;
    }
}

export const hmac = new HmacService();
