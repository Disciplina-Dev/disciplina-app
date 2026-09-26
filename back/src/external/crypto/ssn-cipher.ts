import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { env } from '../../config/env';
import { EncryptedSsn } from '../../types/candidate.types';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const SCRYPT_SALT = 'ssn-salt';

export const MASKED_SSN = '[chiffré]';

const key = scryptSync(env.SSN_ENCRYPTION_KEY, SCRYPT_SALT, 32);

export function encryptSsn(plain: string): EncryptedSsn {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex') };
}

const HEX = /^[0-9a-f]+$/i;

function isHex(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && HEX.test(value);
}

/**
 * Les fiches créées avant l'introduction du chiffrement portent encore un NIR en
 * clair (simple `string`) au lieu du triplet `{ encrypted, iv, tag }`. Comme les
 * lectures Mongo passent par `.lean()` (aucun cast Mongoose), cette valeur legacy
 * remonte telle quelle jusqu'ici : on la détecte explicitement plutôt que de
 * laisser `Buffer.from(undefined, 'hex')` lever un `TypeError` opaque.
 */
export function isEncryptedSsn(value: unknown): value is EncryptedSsn {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<EncryptedSsn>;
    return isHex(candidate.encrypted) && isHex(candidate.iv) && isHex(candidate.tag);
}

export function decryptSsn(enc: unknown): string {
    if (!isEncryptedSsn(enc)) {
        throw new Error(
            `Valeur de NIR non déchiffrable : triplet { encrypted, iv, tag } attendu, reçu ${typeof enc === 'object' ? 'un objet incomplet' : typeof enc}.`,
        );
    }
    const decipher = createDecipheriv(ALGO, key, Buffer.from(enc.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(enc.encrypted, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
}
