import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { AlternantModel } from '../../../db/mongo/schemas/alternant.schema';
import { NeedsAnalysisModel } from '../../../db/mongo/schemas/needsAnalysis.schema';
import { OfferModel } from '../../../db/mongo/schemas/offer.schema';
import { CandidateService } from '../../../services/CandidateService';
import { TitleProfessionalType, CandidateStatus } from '../../../types/candidate.types';
import { JobRole, Permission } from '../../../types/user.types';
import { FilizService } from '../../../external/filiz/filiz.service';

const BASE = `http://localhost:${env.API_PORT}/api/filiz`;

const completeIdentity = {
    phone: '0692000004',
    place_of_birth: 'Saint-Denis',
    department_of_birth: '974',
    born_in_france: true,
    nationality: 1,
    sex: 'GARCON',
    address: '1 rue des Fleurs',
    postal_code: '97400',
    city: 'Saint-Denis',
    country: 'France',
};

async function seedCandidate(id: string, identity: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    await new CandidateService().create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: { full_name: 'Jean DUPONT', email: `${id}@test.local`, phone: '0692000004', ...identity } as any,
        consentments: {
            data_processing: true,
            data_sharing: true,
            ai_processing: false,
            photo_processing: false,
            consent_date: new Date(),
            consent_version: '1',
        },
        ...extra,
    } as any);
    return id;
}

async function postFolder(candidateId: string) {
    const auth = mintAuthCookies({
        id: 1,
        email: 'rh-folders@test.local',
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
        }),
    });
    return { status: res.status, json: await res.json() };
}

describe('POST /api/filiz/folders — start step', () => {
    beforeEach(async () => {
        await AlternantModel.deleteMany({ 'filiz.folder_id': { $exists: true } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts at step 1 for a candidate with only name, email and birth date, and mirrors the folder on an alternant', async () => {
        const spy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('folder-step1');
        const id = await seedCandidate(`cand-folders-1-${Date.now()}`, { date_of_birth: new Date('2000-05-12') });

        const { status, json } = await postFolder(id);

        expect(status).toBe(200);
        expect(json).toEqual({ folderId: 'folder-step1', step: 1 });
        const payload = spy.mock.calls[0][0];
        expect(payload.config.folder.step).toBe(1);
        expect(payload.studentInfos).toEqual({
            firstName: 'Jean',
            lastName: 'DUPONT',
            mailAddress: `${id}@test.local`,
        });
        const alternants = await AlternantModel.find({ 'filiz.folder_id': 'folder-step1' }).lean();
        expect(alternants).toHaveLength(1);
        expect(alternants[0]).toMatchObject({ first_name: 'Jean', last_name: 'DUPONT', candidate_id: id });
        expect(alternants[0].filiz).toMatchObject({ class_id: 'class-1', start_step: 1, step: 1, company_siret: null });
    });

    it('starts at step 4 with a complete identity and a contract linked to a company', async () => {
        const spy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('folder-step4');
        const suffix = Date.now();
        await NeedsAnalysisModel.create({
            _id: `na-folders-${suffix}`,
            company_infos: { name: 'ENTREPRISE7', siret: '22222222222207' },
            referents: { recruitment_referents: { name: 'Marie DURAND', email: 'marie@entreprise.test' } },
        });
        await OfferModel.create({
            _id: `offer-folders-${suffix}`,
            needs_analysis_id: `na-folders-${suffix}`,
            title: 'Vendeur',
        });
        const id = await seedCandidate(
            `cand-folders-4-${suffix}`,
            { ...completeIdentity, date_of_birth: new Date('2000-05-12') },
            { contract_offer_id: `offer-folders-${suffix}` },
        );

        const { status, json } = await postFolder(id);

        expect(status).toBe(200);
        expect(json.step).toBe(4);
        const payload = spy.mock.calls[0][0];
        expect(payload.companyInfos).toMatchObject({ siretNumber: '22222222222207', legalName: 'ENTREPRISE7' });
        expect(payload.contactCompanyInfos).toEqual({
            firstName: 'Marie',
            lastName: 'DURAND',
            mailAddress: 'marie@entreprise.test',
        });
        expect(payload.config.folder).toMatchObject({
            step: 4,
            contractType: 'APPRENTICESHIP',
            missionTitle: 'Vendeur',
        });
        const alternant = await AlternantModel.findOne({ 'filiz.folder_id': 'folder-step4' }).lean();
        expect(alternant?.filiz).toMatchObject({ start_step: 4, company_siret: '22222222222207' });
    });

    it('refuses a minor without calling Filiz', async () => {
        const spy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('never');
        const minorBirth = new Date();
        minorBirth.setUTCFullYear(minorBirth.getUTCFullYear() - 16);
        const id = await seedCandidate(`cand-folders-minor-${Date.now()}`, { date_of_birth: minorBirth });

        const { status, json } = await postFolder(id);

        expect(status).toBe(422);
        expect(json.error).toMatch(/minor/);
        expect(spy).not.toHaveBeenCalled();
    });

    it('refuses a candidate without birth date and lists the missing fields', async () => {
        const spy = vi.spyOn(FilizService.prototype, 'createFolder').mockResolvedValue('never');
        const id = await seedCandidate(`cand-folders-nodob-${Date.now()}`, {});

        const { status, json } = await postFolder(id);

        expect(status).toBe(422);
        expect(json.missing).toEqual(['date_of_birth']);
        expect(spy).not.toHaveBeenCalled();
    });
});
