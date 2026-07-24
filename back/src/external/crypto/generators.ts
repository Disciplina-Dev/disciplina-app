import { randomBytes, randomInt } from 'crypto';

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour un identifiant lisible à la main.
const UNAMBIGUOUS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateSignature(): string {
    return randomBytes(32).toString('hex');
}

export function generateExternalSignature(): string {
    return randomBytes(64).toString('hex');
}

export function generateNumericCode(length: number = 6): string {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += randomInt(0, 10).toString();
    }
    return code;
}

export function generateIdentifier(length: number = 8): string {
    let identifier = '';
    for (let i = 0; i < length; i++) {
        identifier += UNAMBIGUOUS_ALPHABET[randomInt(0, UNAMBIGUOUS_ALPHABET.length)];
    }
    return `ENT-${identifier}`;
}
