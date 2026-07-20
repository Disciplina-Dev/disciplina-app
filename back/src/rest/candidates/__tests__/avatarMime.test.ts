import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';
import { mintToken } from '../../../../test/helpers/auth';

const URL = `http://localhost:${env.API_PORT}/api/candidates/000000000000000000000000/avatar`;

// Le handler ne lit que les premiers octets : des signatures synthétiques suffisent
// et évitent une dépendance à un encodeur d'image en CI.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(64),
]);

function upload(bytes: Buffer, filename: string, declaredType: string) {
    const form = new FormData();
    form.append('photo', new Blob([bytes], { type: declaredType }), filename);
    return fetch(URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${mintToken({ id: 1, email: 'rh@test.com', role: 'RH', permission: 'EMPLOYEE' })}`,
        },
        body: form,
    });
}

describe('avatar upload rejects by content, not by declaration', () => {
    it('refuses an SVG payload declared as image/svg+xml', async () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        const res = await upload(svg, 'x.svg', 'image/svg+xml');
        expect(res.status).toBe(400);
    });

    it('refuses HTML disguised with an image/png content-type', async () => {
        const html = Buffer.from('<html><script>alert(1)</script></html>');
        const res = await upload(html, 'x.png', 'image/png');
        expect(res.status).toBe(400);
    });

    it('refuses an empty file', async () => {
        const res = await upload(Buffer.alloc(0), 'x.png', 'image/png');
        expect(res.status).toBe(400);
    });

    // 404 = candidat inexistant : la détection de type a été franchie.
    it.each([
        ['PNG', PNG],
        ['JPEG', JPEG],
        ['WebP', WEBP],
    ])('accepts a real %s even when mis-declared', async (_label, bytes) => {
        const res = await upload(bytes, 'x.bin', 'application/octet-stream');
        expect(res.status).not.toBe(400);
    });
});
