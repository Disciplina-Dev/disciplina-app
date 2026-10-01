import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';

const URL = `http://localhost:${env.API_PORT}/api/candidates/000000000000000000000000/cv`;

// Le handler ne lit que les premiers octets : une signature synthétique suffit et
// évite une dépendance à un générateur de PDF en CI.
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n', 'ascii'), Buffer.alloc(64)]);

function upload(bytes: Buffer, declaredType: string) {
    const { cookieHeader, csrfHeader } = mintAuthCookies({
        id: 1,
        email: 'rh@test.com',
        role: 'RH',
        permission: 'EMPLOYEE',
    });
    return fetch(URL, {
        method: 'POST',
        headers: {
            Cookie: cookieHeader,
            'x-csrf-token': csrfHeader,
            'Content-Type': declaredType,
        },
        body: bytes,
    });
}

describe('CV upload rejects a fake PDF declared as application/pdf', () => {
    it('refuses HTML disguised with an application/pdf content-type', async () => {
        const html = Buffer.from('<html><script>alert(1)</script></html>');
        const res = await upload(html, 'application/pdf');
        expect(res.status).toBe(400);
    });

    it('refuses a truncated/empty payload declared as application/pdf', async () => {
        const res = await upload(Buffer.from('oops'), 'application/pdf');
        expect(res.status).toBe(400);
    });

    // 404 = candidat inexistant : la vérification de signature a été franchie.
    it('accepts a real PDF declared as application/pdf', async () => {
        const res = await upload(PDF, 'application/pdf');
        expect(res.status).not.toBe(400);
    });

    it('does not run the PDF signature check for image uploads', async () => {
        const html = Buffer.from('<html><script>alert(1)</script></html>');
        const res = await upload(html, 'image/png');
        // Pas un PDF déclaré : non concerné par ce garde-fou, le flux normal continue.
        expect(res.status).not.toBe(400);
    });
});
