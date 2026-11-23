import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql, dropMongo } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { NeedsAnalysisModel } from '../../../db/mongo/schemas/needsAnalysis.schema';
import { AbDriveConfigService } from '../../../services/AbDriveConfigService';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/needs-analysis`;

const RH = mintAuthCookies({ id: 1, email: 'rh@test.local', role: 'RH', permission: 'EMPLOYEE' });
const OWNER = mintAuthCookies({ id: 42, email: 'commercial@test.local', role: 'COMMERCIAL', permission: 'EMPLOYEE' });
const OTHER = mintAuthCookies({ id: 43, email: 'autre@test.local', role: 'COMMERCIAL', permission: 'EMPLOYEE' });
const PEDA = mintAuthCookies({ id: 44, email: 'peda@test.local', role: 'PEDA', permission: 'EMPLOYEE' });
const MANAGER = mintAuthCookies({
    id: 45,
    email: 'responsable@test.local',
    role: 'COMMERCIAL',
    permission: 'RESPONSABLE',
});

const DRIVE_FILE = 'https://drive.google.com/file/d/abc123/view';

async function seedAb(overrides: Record<string, unknown> = {}): Promise<string> {
    const id = 'ab-drive-test-1';
    await NeedsAnalysisModel.create({
        _id: id,
        status: 'EN_ATTENTE_SIGNATURE',
        company_infos: { id: 1, name: 'ACME', sector: 'SUD' },
        saler_info: { id: 42, email: 'commercial@test.local' },
        positions: [],
        created_at: new Date(),
        updated_at: new Date(),
        ...overrides,
    });
    return id;
}

function open(id: string, auth: { cookieHeader: string } | null, redirect: RequestRedirect = 'manual') {
    return fetch(`${ENDPOINT}/${id}/ab-drive`, {
        redirect,
        headers: auth ? { Cookie: auth.cookieHeader } : {},
    });
}

describe('GET /api/needs-analysis/:id/ab-drive', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('redirige vers le lien Drive mémorisé à l’archivage', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, RH);

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(DRIVE_FILE);
    });

    it('résout et mémorise le lien des AB antérieures au champ', async () => {
        const id = await seedAb();
        const spy = vi
            .spyOn(AbDriveConfigService.prototype, 'resolveAbPdfLink')
            .mockResolvedValue({ url: DRIVE_FILE, isFile: true });

        const res = await open(id, RH);

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(DRIVE_FILE);
        expect(spy).toHaveBeenCalledTimes(1);
        const stored = await NeedsAnalysisModel.findById(id).lean();
        expect(stored?.ab_drive_url).toBe(DRIVE_FILE);
    });

    it('ne mémorise pas le repli sur le dossier Drive', async () => {
        const id = await seedAb();
        const folder = 'https://drive.google.com/drive/folders/folder-1';
        vi.spyOn(AbDriveConfigService.prototype, 'resolveAbPdfLink').mockResolvedValue({
            url: folder,
            isFile: false,
        });

        const res = await open(id, RH);

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(folder);
        const stored = await NeedsAnalysisModel.findById(id).lean();
        expect(stored?.ab_drive_url ?? null).toBeNull();
    });

    it('refuse un commercial qui n’est pas propriétaire de l’AB', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, OTHER);

        expect(res.status).toBe(403);
    });

    it('autorise le commercial propriétaire', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, OWNER);

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(DRIVE_FILE);
    });

    it('autorise un responsable à ouvrir l’AB d’un autre commercial', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, MANAGER);

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(DRIVE_FILE);
    });

    it('refuse un utilisateur non authentifié', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, null);

        expect(res.status).toBe(401);
    });

    it('refuse un rôle hors commercial / RH / responsable', async () => {
        const id = await seedAb({ ab_drive_url: DRIVE_FILE });

        const res = await open(id, PEDA);

        expect(res.status).toBe(403);
    });

    it('renvoie 404 quand aucune archive Drive n’est résolvable', async () => {
        const id = await seedAb();
        vi.spyOn(AbDriveConfigService.prototype, 'resolveAbPdfLink').mockResolvedValue(null);

        const res = await open(id, RH);

        expect(res.status).toBe(404);
    });
});
