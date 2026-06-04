import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { env } from '../../config/env';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

export function encryptToken(plain: string): string {
    const key = Buffer.from(env.OAUTH_ENCRYPTION_KEY, 'hex');
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const [ivHex, tagHex, dataHex] = parts;
    const key = Buffer.from(env.OAUTH_ENCRYPTION_KEY, 'hex');
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8');
}

export function isEncryptedToken(s: string): boolean {
    return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(s);
}
