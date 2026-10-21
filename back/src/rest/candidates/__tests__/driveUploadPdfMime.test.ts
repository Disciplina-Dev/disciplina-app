import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';

const URL = `http://localhost:${env.API_PORT}/api/candidates/000000000000000000000000/drive-upload`;

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n', 'ascii'), Buffer.alloc(64)]);

function upload(files: { bytes: Buffer; filename: string; declaredType: string }[]) {
    const form = new FormData();
    for (const f of files) {
        form.append('files', new Blob([f.bytes], { type: f.declaredType }), f.filename);
    }
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
        },
        body: form,
    });
}

describe('Drive upload rejects a fake PDF declared as application/pdf', () => {
    it('refuses HTML disguised with an application/pdf content-type', async () => {
        const html = Buffer.from('<html><script>alert(1)</script></html>');
        const res = await upload([{ bytes: html, filename: 'x.pdf', declaredType: 'application/pdf' }]);
        expect(res.status).toBe(400);
    });

    it('rejects the whole batch if one file among several is an invalid PDF', async () => {
        const html = Buffer.from('<html></html>');
        const res = await upload([
            { bytes: PDF, filename: 'ok.pdf', declaredType: 'application/pdf' },
            { bytes: html, filename: 'bad.pdf', declaredType: 'application/pdf' },
        ]);
        expect(res.status).toBe(400);
    });

    // 404 = candidat inexistant : la vérification de signature a été franchie.
    it('accepts a real PDF declared as application/pdf', async () => {
        const res = await upload([{ bytes: PDF, filename: 'x.pdf', declaredType: 'application/pdf' }]);
        expect(res.status).not.toBe(400);
    });

    it('does not run the PDF signature check for non-PDF files', async () => {
        const html = Buffer.from('<html></html>');
        const res = await upload([{ bytes: html, filename: 'x.docx', declaredType: 'application/msword' }]);
        expect(res.status).not.toBe(400);
    });
});
