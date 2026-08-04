import { randomBytes, createCipheriv, scryptSync } from 'crypto';
import { env } from '../../config/env';
import { EncryptedSsn } from '../../types/candidate.types';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const SCRYPT_SALT = 'ssn-salt';

const key = scryptSync(env.SSN_ENCRYPTION_KEY, SCRYPT_SALT, 32);

export function encryptSsn(plain: string): EncryptedSsn {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex') };
}
