import { describe, it, expect } from 'vitest';
import { CandidateService } from '../CandidateService';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';

describe('CandidateService immersion_agreement status sync', () => {
    const service = new CandidateService();

    async function seedCandidate(
        status: CandidateStatus,
        suffix: number,
        immersionEndDate?: Date,
        immersionAgreement?: boolean,
    ): Promise<string> {
        const id = `cand-imm-agree-${suffix}`;
        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.CC],
            status,
            immersion_agreement: immersionAgreement,
            immersion_end_date: immersionEndDate,
            identity: {
                full_name: `Candidat Immersion ${suffix}`,
                email: `cand-imm-agree-${suffix}@test.local`,
                phone: '0692000001',
            } as any,
        } as any);
        return id;
    }

it('cochète immersion_agreement à l’entrée en immersion', async () => {
        const suffix = Date.now();
        const id = await seedCandidate(CandidateStatus.SEEKING, suffix);

        await service.update(id, { status: CandidateStatus.IMMERSING });

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.immersion_agreement).toBe(true);
        expect(stored?.status).toBe(CandidateStatus.IMMERSING);
    });

    it('décochète immersion_agreement en quittant l’immersion (contrat)', async () => {
        const suffix = Date.now() + 1;
        const id = await seedCandidate(CandidateStatus.IMMERSING, suffix, undefined, true);

        await service.update(id, { status: CandidateStatus.CONTRACT });

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.immersion_agreement).toBe(false);
        expect(stored?.status).toBe(CandidateStatus.CONTRACT);
    });

    it('décochète immersion_agreement en quittant l’immersion (retour en recherche)', async () => {
        const suffix = Date.now() + 2;
        const id = await seedCandidate(CandidateStatus.IMMERSING, suffix, undefined, true);

        await service.update(id, { status: CandidateStatus.SEEKING });

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.immersion_agreement).toBe(false);
    });

    it('laisse intact l’accord manuel d’un candidat en recherche (pas de transition)', async () => {
        const suffix = Date.now() + 3;
        const id = await seedCandidate(CandidateStatus.SEEKING, suffix);

        await service.update(id, { status: CandidateStatus.SEEKING, immersion_agreement: true });

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.immersion_agreement).toBe(true);
    });

    it('décochète immersion_agreement lors du retour automatique en recherche après la fin d’immersion', async () => {
        const suffix = Date.now() + 4;
        const id = await seedCandidate(
            CandidateStatus.IMMERSING,
            suffix,
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            true,
        );

        await service.findById(id);

        const stored = await CandidateModel.findById(id).lean();
        expect(stored?.status).toBe(CandidateStatus.SEEKING);
        expect(stored?.immersion_agreement).toBe(false);
    });
});