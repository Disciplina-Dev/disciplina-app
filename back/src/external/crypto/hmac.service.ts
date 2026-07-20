import { createHmac } from 'crypto';
import { timingSafeEqualString } from './compare';

type HmacEncoding = 'hex' | 'base64';

export class HmacService {
    sign(secret: string, payload: string, encoding: HmacEncoding = 'hex'): string {
        return createHmac('sha256', secret).update(payload).digest(encoding);
    }

    verify(secret: string, payload: string, sig: string, encoding: HmacEncoding = 'hex'): boolean {
        return timingSafeEqualString(this.sign(secret, payload, encoding), sig);
    }
}

export const hmac = new HmacService();
