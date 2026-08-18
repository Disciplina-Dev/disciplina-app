import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AbDriveConfigModel, AB_DRIVE_CONFIG_ID } from '../../db/mongo/schemas/abDriveConfig.schema';
import { GoogleDriveService } from '../../external/google/drive.service';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { AbDriveConfigService } from '../AbDriveConfigService';
import { CompanyRegion } from '../../types/needsAnalysisNoSql.types';

describe('AB Drive archive', () => {
    const service = new AbDriveConfigService();
    let uploadFile: ReturnType<typeof vi.fn>;
    let fromTokensSpy: ReturnType<typeof vi.spyOn>;

    async function createCommercial(label: string, oauthToken: string | null, refreshToken: string | null): Promise<number> {
        return new UserRepository().create({
            email: `ab-drive-${label}-${Date.now()}@test.local`,
            first_name: 'Commercial',
            last_name: label,
            password: 'hashed',
            role_id: 1,
            permission_id: 1,
            sectors: ['Sud'],
            oauth_token: oauthToken,
            refresh_token: refreshToken,
        });
    }

    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();

        uploadFile = vi.fn().mockResolvedValue({ id: 'drive-file-id', webViewLink: 'https://drive.test/file' });
        fromTokensSpy = vi.spyOn(GoogleDriveService, 'fromTokens').mockImplementation(((creds: any) => ({
            uploadFile,
        }) as any) as typeof GoogleDriveService.fromTokens);

        await AbDriveConfigModel.findByIdAndUpdate(
            AB_DRIVE_CONFIG_ID,
            {
                _id: AB_DRIVE_CONFIG_ID,
                sector_folders: { Sud_SIGNED: 'folder-sud-signed' },
                updated_at: new Date(),
            },
            { upsert: true, setDefaultsOnInsert: true },
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prefers a refreshable Google account when the acting user and creator have no refresh token', async () => {
        const actingUserId = await createCommercial('acting', 'tok-acting', null);
        const creatorId = await createCommercial('creator', 'tok-creator', null);
        await createCommercial('backup', 'tok-backup', 'refresh-backup');

        const link = await service.archiveAbPdf(
            CompanyRegion.SUD,
            'SIGNED',
            Buffer.from('pdf'),
            'signed.pdf',
            creatorId,
            actingUserId,
        );

        expect(link).toBe('https://drive.test/file');
        expect(uploadFile).toHaveBeenCalledTimes(1);
        expect(fromTokensSpy).toHaveBeenCalled();
        const [creds] = fromTokensSpy.mock.calls[0];
        expect(creds.access_token).toBe('tok-backup');
        expect(creds.refresh_token).toBe('refresh-backup');
    });

    it('skips the upload when no SIGNED folder is configured for the sector', async () => {
        await AbDriveConfigModel.findByIdAndUpdate(
            AB_DRIVE_CONFIG_ID,
            { sector_folders: {} },
            { upsert: true, setDefaultsOnInsert: true },
        );

        const actingUserId = await createCommercial('acting', 'tok-acting', 'refresh-acting');
        const creatorId = await createCommercial('creator', 'tok-creator', 'refresh-creator');

        const link = await service.archiveAbPdf(CompanyRegion.SUD, 'SIGNED', Buffer.from('pdf'), 'signed.pdf', creatorId, actingUserId);

        expect(link).toBeNull();
        expect(uploadFile).not.toHaveBeenCalled();
    });
});
