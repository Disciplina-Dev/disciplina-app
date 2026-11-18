import { randomBytes, createCipheriv, createDecipheriv, createHash, hkdfSync } from 'crypto';
import { env } from '../../config/env';

// Chiffrement applicatif des données de santé / handicap / contact d'urgence (GDPR_INF_02.3).
// Valeur JSON sérialisée → AES-256-GCM → chaîne unique `h1:<kid>:<iv>:<tag>:<data>` (hex).
// Une chaîne unique évite que `flattenObject` (CandidateRepository) éclate le chiffré en clés pointées.
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const HKDF_INFO = 'disciplina:health:v1';
const PREFIX = 'h1';
const ENCRYPTED_RE = /^h1:[0-9a-f]{8}:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

interface KeyEntry {
    kid: string;
    key: Buffer;
}

function deriveKey(secretHex: string, saltHex: string): KeyEntry {
    const key = Buffer.from(
        hkdfSync('sha256', Buffer.from(secretHex, 'hex'), Buffer.from(saltHex, 'hex'), HKDF_INFO, 32),
    );
    return { kid: createHash('sha256').update(key).digest('hex').slice(0, 8), key };
}

const active = deriveKey(env.HEALTH_ENCRYPTION_KEY, env.HEALTH_KDF_SALT);

const previous =
    env.HEALTH_ENCRYPTION_KEY_PREVIOUS && env.HEALTH_KDF_SALT_PREVIOUS
        ? deriveKey(env.HEALTH_ENCRYPTION_KEY_PREVIOUS, env.HEALTH_KDF_SALT_PREVIOUS)
        : undefined;

/** `kid` de la clé active : sert à repérer les valeurs à ré-encrypter. */
export const ACTIVE_HEALTH_KID = active.kid;

function resolveKey(kid: string): Buffer {
    if (kid === active.kid) return active.key;
    if (previous && kid === previous.kid) return previous.key;
    throw new Error(
        `Donnée de santé chiffrée avec une clé inconnue (kid ${kid}) : HEALTH_ENCRYPTION_KEY_PREVIOUS manquante ?`,
    );
}

/** Vrai pour une valeur produite par `encryptHealthValue` (lectures `.lean()` : aucun cast Mongoose). */
export function isEncryptedHealth(value: unknown): value is string {
    return typeof value === 'string' && ENCRYPTED_RE.test(value);
}

export function encryptHealthValue(value: unknown): string {
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error('Donnée de santé non sérialisable');
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, active.key, iv);
    const data = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, active.kid, iv.toString('hex'), tag.toString('hex'), data.toString('hex')].join(':');
}

export function decryptHealthValue<T = unknown>(enc: unknown): T {
    if (!isEncryptedHealth(enc)) {
        throw new Error(`Donnée de santé non déchiffrable : format h1:kid:iv:tag:data attendu, reçu ${typeof enc}.`);
    }
    const [, kid, iv, tag, data] = enc.split(':');
    const decipher = createDecipheriv(ALGO, resolveKey(kid), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    const json = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
    return JSON.parse(json) as T;
}

/**
 * Lecture tolérante : renvoie la valeur déchiffrée, ou la valeur telle quelle si elle est encore
 * en clair (fiche antérieure au backfill, seed Python). `undefined`/`null` passent inchangés.
 */
export function decryptHealthIfNeeded<T = unknown>(value: unknown): T {
    return (isEncryptedHealth(value) ? decryptHealthValue<T>(value) : value) as T;
}

/** Écriture idempotente : ne rechiffre pas une valeur déjà chiffrée ; `undefined`/`null` passent inchangés. */
export function encryptHealthIfNeeded(value: unknown): unknown {
    if (value === undefined || value === null || isEncryptedHealth(value)) return value;
    return encryptHealthValue(value);
}

export type HealthRotationAction = 'plaintext' | 'rotated' | 'current';

/**
 * Ramène une valeur stockée vers la clé active (idempotent) :
 * - valeur en clair → chiffrée ; chiffrée avec une autre clé → déchiffrée puis rechiffrée ;
 * - déjà à la clé active → inchangée. Le résultat est relu avant d'être renvoyé.
 */
export function reencryptHealthValue(value: unknown): { value: string; action: HealthRotationAction } {
    if (!isEncryptedHealth(value)) {
        const out = encryptHealthValue(value);
        if (JSON.stringify(decryptHealthValue(out)) !== JSON.stringify(value)) {
            throw new Error('Relecture de la donnée de santé chiffrée incohérente');
        }
        return { value: out, action: 'plaintext' };
    }
    if (value.split(':')[1] === active.kid) {
        decryptHealthValue(value);
        return { value, action: 'current' };
    }
    const plain = decryptHealthValue(value);
    const out = encryptHealthValue(plain);
    if (JSON.stringify(decryptHealthValue(out)) !== JSON.stringify(plain)) {
        throw new Error('Relecture de la donnée de santé ré-encryptée incohérente');
    }
    return { value: out, action: 'rotated' };
}
