import { describe, it, expect } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/needs-analysis`;
const auth = mintAuthCookies({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'RESPONSABLE' });

const UPDATE = `
    mutation ($input: AbDriveConfigInput!) {
        updateAbDriveConfig(input: $input) {
            sectorFolders { sector kind folderId }
        }
    }
`;

async function update(sector: string) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({
            query: UPDATE,
            variables: { input: { sectorFolders: [{ sector, kind: 'SIGNED', folderId: 'folder-1' }] } },
        }),
    });
    return res.json();
}

describe('updateAbDriveConfig sector validation', () => {
    it('accepts a sector of the referential', async () => {
        const json = await update('Nord-Est');
        expect(json.errors).toBeUndefined();
        const saved = json.data.updateAbDriveConfig.sectorFolders.find(
            (f: { sector: string; kind: string }) => f.sector === 'Nord-Est' && f.kind === 'SIGNED',
        );
        expect(saved.folderId).toBe('folder-1');
    });

    it('rejects an unknown sector', async () => {
        const json = await update('Atlantide');
        expect(json.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    });
});
