import { describe, it, expect, vi, afterEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { CandidateService } from '../../../services/CandidateService';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';
import { JobRole, Permission } from '../../../types/user.types';
import { FilizService } from '../../../external/filiz/filiz.service';
import { logger } from '../../../external/logger';

const BASE = `http://localhost:${env.API_PORT}/api/filiz`;

async function seedCandidate(suffix: number, dataSharing: boolean): Promise<string> {
    const service = new CandidateService();
    const id = `cand-filiz-consent-${suffix}`;
    await service.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Candidat Filiz Consentement ${suffix}`,
            email: `cand-filiz-consent-${suffix}@test.local`,
            phone: '0692000004',
        } as any,
        consentments: {
            data_processing: true,
            data_sharing: dataSharing,
            ai_processing: false,
            photo_processing: false,
            consent_date: new Date(),
            consent_version: '1',
        },
    } as any);
    return id;
}

describe('POST /api/filiz/folders — data_sharing consent (warn-only grace period)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('still creates the folder when data_sharing consent is missing (warn mode)', async () => {
        const createFolderSpy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('folder-123');
        const warnSpy = vi.spyOn(logger, 'warn');
        const suffix = Date.now();
        const candidateId = await seedCandidate(suffix, false);
        const auth = mintAuthCookies({
            id: 1,
            email: 'rh-filiz@test.local',
            role: JobRole.RH,
            permission: Permission.EMPLOYEE,
        });

        const res = await fetch(`${BASE}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                candidateId,
                classId: 'class-1',
                fileManagerFirstName: 'Jane',
                fileManagerLastName: 'Doe',
                fileManagerEmail: 'jane.doe@test.local',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.folderId).toBe('folder-123');
        expect(createFolderSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            { required: ['data_sharing'] },
            'Candidate missing consent, allowed under warn-only grace period',
        );
    });

    it('creates the folder when data_sharing consent is granted', async () => {
        const createFolderSpy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('folder-456');
        const suffix = Date.now() + 1;
        const candidateId = await seedCandidate(suffix, true);
        const auth = mintAuthCookies({
            id: 1,
            email: 'rh-filiz2@test.local',
            role: JobRole.RH,
            permission: Permission.EMPLOYEE,
        });

        const res = await fetch(`${BASE}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                candidateId,
                classId: 'class-1',
                fileManagerFirstName: 'Jane',
                fileManagerLastName: 'Doe',
                fileManagerEmail: 'jane.doe@test.local',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.folderId).toBe('folder-456');
        expect(createFolderSpy).toHaveBeenCalled();
    });
});
