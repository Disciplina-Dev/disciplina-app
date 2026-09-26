import { describe, it, expect, vi, afterEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { CandidateService } from '../../../services/CandidateService';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';
import { JobRole, Permission } from '../../../types/user.types';
import { OllamaService } from '../../../external/ollama/ollama.service';

const BASE = `http://localhost:${env.API_PORT}/api/candidates`;

async function seedCandidate(suffix: number, aiProcessing: boolean): Promise<string> {
    const service = new CandidateService();
    const id = `cand-consent-${suffix}`;
    await service.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Candidat Consentement ${suffix}`,
            email: `cand-consent-${suffix}@test.local`,
            phone: '0692000002',
        } as any,
        consentments: {
            data_processing: true,
            data_sharing: false,
            ai_processing: aiProcessing,
            photo_processing: false,
            consent_date: new Date(),
            consent_version: '1',
        },
    } as any);
    return id;
}

describe('POST /api/candidates/:id/generate-summary — consent (warn-only grace period)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('still generates a summary when ai_processing consent is missing (warn mode)', async () => {
        const chatSpy = vi.spyOn(OllamaService.prototype, 'chat').mockResolvedValue('Résumé généré.');
        const suffix = Date.now();
        const id = await seedCandidate(suffix, false);
        const auth = mintAuthCookies({
            id: 1,
            email: 'rh@test.local',
            role: JobRole.RH,
            permission: Permission.EMPLOYEE,
        });

        const res = await fetch(`${BASE}/${id}/generate-summary`, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        });

        expect(res.status).toBe(200);
        expect(chatSpy).toHaveBeenCalled();
    });

    it('generates a summary when ai_processing consent is granted', async () => {
        const chatSpy = vi.spyOn(OllamaService.prototype, 'chat').mockResolvedValue('Résumé généré.');
        const suffix = Date.now() + 1;
        const id = await seedCandidate(suffix, true);
        const auth = mintAuthCookies({
            id: 1,
            email: 'rh2@test.local',
            role: JobRole.RH,
            permission: Permission.EMPLOYEE,
        });

        const res = await fetch(`${BASE}/${id}/generate-summary`, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        });

        expect(res.status).toBe(200);
        expect(chatSpy).toHaveBeenCalled();
    });
});
