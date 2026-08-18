// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AbDriveConfigModel, AB_DRIVE_CONFIG_ID } from '../../db/mongo/schemas/abDriveConfig.schema';
import { GoogleDriveService } from '../../external/google/drive.service';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { AbDriveConfigService } from '../AbDriveConfigService';
import { CompanyRegion } from '../../types/needsAnalysisNoSql.types';

describe('AB Drive archive', () => {
    const service = new AbDriveConfigService();
    const googleDriveServiceAny: any = GoogleDriveService;
    let uploadFile: any;
    let findFolder: any;
    let createFolder: any;
    let originalFromTokens: any;
    let fromTokensArgs: any[] | null;
    let uploadFileCalls: any[][];
    let findFolderCalls: any[][];
    let createFolderCalls: any[][];
    let findFolderResult: { id: string; webViewLink: string } | null;

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

        uploadFileCalls = [];
        findFolderCalls = [];
        createFolderCalls = [];
        findFolderResult = null;
        uploadFile = async (...args: any[]) => {
            uploadFileCalls.push(args);
            return { id: 'drive-file-id', webViewLink: 'https://drive.test/file' };
        };
        findFolder = async (...args: any[]) => {
            findFolderCalls.push(args);
            return findFolderResult;
        };
        createFolder = async (...args: any[]) => {
            createFolderCalls.push(args);
            return { id: 'company-folder-id', webViewLink: 'https://drive.test/folder' };
        };
        originalFromTokens = googleDriveServiceAny.fromTokens;
        fromTokensArgs = null;
        // @ts-ignore manual test double for GoogleDriveService.fromTokens
        googleDriveServiceAny.fromTokens = ((creds: any) => {
            fromTokensArgs = [creds];
            return {
                findFolder,
                createFolder,
                uploadFile,
            } as any;
        }) as any;

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
        // @ts-ignore manual test double restore
        googleDriveServiceAny.fromTokens = originalFromTokens;
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
            'ACME',
            creatorId,
            actingUserId,
        );

        expect(link).toBe('https://drive.test/file');
        expect(uploadFileCalls).toHaveLength(1);
        expect(findFolderCalls[0]).toEqual(['ACME', 'folder-sud-signed']);
        expect(createFolderCalls[0]).toEqual(['ACME', 'folder-sud-signed']);
        expect(uploadFileCalls[0][0]).toBe('signed.pdf');
        expect(uploadFileCalls[0][1]).toBe('application/pdf');
        expect(uploadFileCalls[0][2]).toEqual(expect.any(Buffer));
        expect(uploadFileCalls[0][3]).toBe('company-folder-id');
        expect(fromTokensArgs).not.toBeNull();
        const creds = fromTokensArgs?.[0] as any;
        expect(creds.access_token).toBe('tok-backup');
        expect(creds.refresh_token).toBe('refresh-backup');
    });

    it('reuses an existing company folder for signed PDFs', async () => {
        findFolderResult = { id: 'existing-company-folder', webViewLink: 'https://drive.test/existing-folder' };

        const actingUserId = await createCommercial('acting', 'tok-acting', 'refresh-acting');
        const creatorId = await createCommercial('creator', 'tok-creator', 'refresh-creator');

        const link = await service.archiveAbPdf(
            CompanyRegion.SUD,
            'SIGNED',
            Buffer.from('pdf'),
            'signed.pdf',
            'ACME',
            creatorId,
            actingUserId,
        );

        expect(link).toBe('https://drive.test/file');
        expect(findFolderCalls[0]).toEqual(['ACME', 'folder-sud-signed']);
        expect(createFolderCalls).toHaveLength(0);
        expect(uploadFileCalls[0][0]).toBe('signed.pdf');
        expect(uploadFileCalls[0][1]).toBe('application/pdf');
        expect(uploadFileCalls[0][2]).toEqual(expect.any(Buffer));
        expect(uploadFileCalls[0][3]).toBe('existing-company-folder');
    });

    it('skips the upload when no SIGNED folder is configured for the sector', async () => {
        await AbDriveConfigModel.findByIdAndUpdate(
            AB_DRIVE_CONFIG_ID,
            { sector_folders: {} },
            { upsert: true, setDefaultsOnInsert: true },
        );

        const actingUserId = await createCommercial('acting', 'tok-acting', 'refresh-acting');
        const creatorId = await createCommercial('creator', 'tok-creator', 'refresh-creator');

        const link = await service.archiveAbPdf(
            CompanyRegion.SUD,
            'SIGNED',
            Buffer.from('pdf'),
            'signed.pdf',
            'ACME',
            creatorId,
            actingUserId,
        );

        expect(link).toBeNull();
        expect(uploadFileCalls).toHaveLength(0);
    });
});
