import { describe, it, expect } from 'vitest';
import { buildRawMessage } from '../mime.builder';

function decode(raw: string): string {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf-8');
}

describe('buildRawMessage cc', () => {
    it('emits a Cc header when cc recipients are given', () => {
        const raw = buildRawMessage({
            to: 'company@test.local',
            cc: ['copy1@test.local', 'copy2@test.local'],
            subject: 'Proposition',
            html: '<p>Bonjour</p>',
            text: 'Bonjour',
        });
        const message = decode(raw);
        expect(message).toContain('To: company@test.local');
        expect(message).toContain('Cc: copy1@test.local, copy2@test.local');
    });

    it('omits the Cc header when no cc recipient is given', () => {
        const raw = buildRawMessage({
            to: 'company@test.local',
            subject: 'Proposition',
            html: '<p>Bonjour</p>',
            text: 'Bonjour',
        });
        expect(decode(raw)).not.toContain('Cc:');
    });
});
