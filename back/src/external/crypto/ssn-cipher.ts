import { randomBytes, createCipheriv, createDecipheriv, createHash, hkdfSync, scryptSync } from 'crypto';
import { env } from '../../config/env';
import { EncryptedSsn } from '../../types/candidate.types';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
// Dérivation historique (scrypt + sel codé en dur), conservée uniquement pour relire
// les NIR chiffrés avant la rotation. Voir back/scripts/rotate-ssn-key.ts.
const LEGACY_SCRYPT_SALT = 'ssn-salt';
const HKDF_INFO = 'disciplina:ssn:v2';

export const MASKED_SSN = '[chiffré]';

interface KeyEntry {
    kid: string;
    key: Buffer;
}

function fingerprint(key: Buffer): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

// Clé v2 : HKDF-SHA256(clé 256 bits du déploiement, sel du déploiement).
function deriveKey(secretHex: string, saltHex: string): KeyEntry {
    const key = Buffer.from(hkdfSync('sha256', Buffer.from(secretHex, 'hex'), Buffer.from(saltHex, 'hex'), HKDF_INFO, 32));
    return { kid: fingerprint(key), key };
}

const active = deriveKey(env.SSN_ENCRYPTION_KEY, env.SSN_KDF_SALT);

const previous =
    env.SSN_ENCRYPTION_KEY_PREVIOUS && env.SSN_KDF_SALT_PREVIOUS
        ? deriveKey(env.SSN_ENCRYPTION_KEY_PREVIOUS, env.SSN_KDF_SALT_PREVIOUS)
        : undefined;

let legacyKey: Buffer | undefined;
// Valeurs sans `kid` : chiffrées avec scrypt(ancien secret, 'ssn-salt'). Dérivée à la demande (scrypt est coûteux).
function getLegacyKey(): Buffer {
    legacyKey ??= scryptSync(env.SSN_ENCRYPTION_KEY_PREVIOUS ?? env.SSN_ENCRYPTION_KEY, LEGACY_SCRYPT_SALT, 32);
    return legacyKey;
}

function resolveKey(kid: string | undefined): Buffer {
    if (kid === undefined) return getLegacyKey();
    if (kid === active.kid) return active.key;
    if (previous && kid === previous.kid) return previous.key;
    throw new Error(`Valeur de NIR chiffrée avec une clé inconnue (kid ${kid}) : SSN_ENCRYPTION_KEY_PREVIOUS manquante ?`);
}

export function encryptSsn(plain: string): EncryptedSsn {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, active.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex'), kid: active.kid };
}

/** `kid` de la clé active : sert à repérer les valeurs à ré-encrypter. */
export const ACTIVE_SSN_KID = active.kid;

const HEX = /^[0-9a-f]+$/i;

function isHex(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && HEX.test(value);
}

/** Valide la forme `{ encrypted, iv, tag }` (lectures `.lean()` : aucun cast Mongoose). */
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
    const decipher = createDecipheriv(ALGO, resolveKey(enc.kid), Buffer.from(enc.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(enc.encrypted, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
}

export type SsnRotationAction = 'plaintext' | 'rotated' | 'current';

/**
 * Ramène une valeur stockée vers la clé active (idempotent) :
 * - `string` (NIR en clair) → chiffré ;
 * - triplet d'une autre clé / format historique → déchiffré puis ré-chiffré ;
 * - triplet déjà à la clé active → inchangé.
 * Le résultat est relu (déchiffrement) avant d'être renvoyé.
 */
export function reencryptSsnValue(value: unknown): { value: EncryptedSsn; action: SsnRotationAction } {
    if (typeof value === 'string') {
        const plain = value.trim();
        if (plain === '') throw new Error('NIR vide');
        const out = encryptSsn(plain);
        if (decryptSsn(out) !== plain) throw new Error('Relecture du NIR ré-encrypté incohérente');
        return { value: out, action: 'plaintext' };
    }
    if (!isEncryptedSsn(value)) throw new Error('Valeur de NIR de forme inconnue');
    if (value.kid === active.kid) {
        decryptSsn(value);
        return { value, action: 'current' };
    }
    const plain = decryptSsn(value);
    const out = encryptSsn(plain);
    if (decryptSsn(out) !== plain) throw new Error('Relecture du NIR ré-encrypté incohérente');
    return { value: out, action: 'rotated' };
}
