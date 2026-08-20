import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { CandidateService } from '../../../services/CandidateService';
import { CandidateAvatarModel } from '../../../db/mongo/schemas/candidate.schema';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';
import { JobRole, Permission } from '../../../types/user.types';
import { logger } from '../../../external/logger';

const BASE = `http://localhost:${env.API_PORT}/api/candidates`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

async function seedCandidate(suffix: number, photoProcessing: boolean): Promise<string> {
    const service = new CandidateService();
    const id = `cand-avatar-consent-${suffix}`;
    await service.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Candidat Avatar Consentement ${suffix}`,
            email: `cand-avatar-consent-${suffix}@test.local`,
            phone: '0692000005',
        } as any,
        consentments: {
            data_processing: true,
            data_sharing: false,
            ai_processing: false,
            photo_processing: photoProcessing,
            consent_date: new Date(),
            consent_version: '1',
        },
    } as any);
    return id;
}

describe('Candidate avatar routes — photo_processing consent (warn-only grace period)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('POST /:id/avatar still stores the photo when consent is missing (warn mode)', async () => {
        const warnSpy = vi.spyOn(logger, 'warn');
        const suffix = Date.now();
        const id = await seedCandidate(suffix, false);
        const { cookieHeader, csrfHeader } = mintAuthCookies({
            id: 1,
            email: 'rh-avatar@test.com',
            role: JobRole.RH,
            permission: Permission.EMPLOYEE,
        });

        const form = new FormData();
        form.append('photo', new Blob([PNG], { type: 'image/png' }), 'x.png');
        const res = await fetch(`${BASE}/${id}/avatar`, {
            method: 'POST',
            headers: { Cookie: cookieHeader, 'x-csrf-token': csrfHeader },
            body: form,
        });

        expect(res.status).toBe(200);
        expect(warnSpy).toHaveBeenCalledWith(
            { required: ['photo_processing'] },
            'Candidate missing consent, allowed under warn-only grace period',
        );
    });

    it('GET /:id/avatar (public) still serves the photo when consent is missing (warn mode)', async () => {
        const warnSpy = vi.spyOn(logger, 'warn');
        const suffix = Date.now() + 1;
        const id = await seedCandidate(suffix, false);
        await CandidateAvatarModel.create({
            candidate_id: id,
            data: PNG,
            content_type: 'image/png',
            updated_at: new Date(),
        });

        const res = await fetch(`${BASE}/${id}/avatar`);

        expect(res.status).toBe(200);
        expect(warnSpy).toHaveBeenCalledWith(
            { required: ['photo_processing'] },
            'Candidate missing consent, allowed under warn-only grace period',
        );
    });

    it('GET /:id/avatar (public) serves the photo when consent is granted, without warning', async () => {
        const warnSpy = vi.spyOn(logger, 'warn');
        const suffix = Date.now() + 2;
        const id = await seedCandidate(suffix, true);
        await CandidateAvatarModel.create({
            candidate_id: id,
            data: PNG,
            content_type: 'image/png',
            updated_at: new Date(),
        });

        const res = await fetch(`${BASE}/${id}/avatar`);

        expect(res.status).toBe(200);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
