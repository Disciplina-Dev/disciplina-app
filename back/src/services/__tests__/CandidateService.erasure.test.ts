import { describe, it, expect, vi } from 'vitest';
import { CandidateService } from '../CandidateService';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { ExternalAccessRepository } from '../../repositories/mysql/ExternalAccessRepository';
import { getModels } from '../../db/mongo/tenant';
import { CandidateStatus, CandidateHistoryType, TitleProfessionalType } from '../../types/candidate.types';
import { seedOffer } from '../../../test/helpers/seedOffer';
import { query } from '../../db/mysql/connection';
import { UserRepository } from '../../repositories/mysql/UserRepository';

// GDPR_INF_06.4 : l'effacement emporte Drive, avatar, historique, matching, accès externes.
describe('CandidateService.delete — erasure cascade', () => {
    const service = new CandidateService();
    const repo = new CandidateRepository();

    async function seedCandidate(suffix: string, extra: Record<string, unknown> = {}) {
        const id = `erasure-${suffix}-${Date.now()}`;
        await repo.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: { full_name: `Erase ${suffix}`, email: `${id}@test.local`, phone: '0100000099' },
            ...extra,
        } as any);
        return id;
    }

    it('deletes Drive copies, local copies and keeps consent history', async () => {
        const id = await seedCandidate('full', {
            drive_folder_id: 'folder-1',
            cv_link: 'https://drive.google.com/file/d/cvfile1/view',
            filiz_folder_id: 'filiz-1',
        });
        const models = getModels();
        await models.CandidateAvatar.create({ candidate_id: id, data: Buffer.from('x'), content_type: 'image/png', updated_at: new Date() });
        await models.CandidateHistory.create({
            _id: `h-${id}`,
            candidate_id: id,
            type: Object.values(CandidateHistoryType)[0],
            description: 'note',
        });
        const offer = await seedOffer({ candidates: [{ id }] as any });
        await models.Alternant.create({ _id: `a-${id}`, first_name: 'A', last_name: 'B', candidate_id: id });
        await models.Notification.create({ _id: `n-${id}`, user_id: 1, type: 't', title: 't', link: `/rh/candidats/${id}` });
        const userId = await new UserRepository().create({
            email: `rh-${id}@test.local`,
            first_name: 'RH',
            last_name: 'Erasure',
            password: 'hashed',
            role_id: 2,
            permission_id: 1,
            sectors: null,
            oauth_token: null,
            refresh_token: null,
        });
        await new ExternalAccessRepository().create({
            signature: `sig-${id}`,
            code: null,
            user_id: userId,
            external_id: id,
            external_type: 'CANDIDATE',
            external_email: null,
            external_first_name: null,
            token: null,
            reference_id: 1,
            reference_key: 'k',
            status: 'PENDING',
            attempts: 0,
            expires_at: null,
        });
        await query(
            `INSERT INTO candidate_consent_history (candidate_id, consent_type, granted, source) VALUES (?, 'PHOTO_PROCESSING', 1, 'WITHDRAWAL')`,
            [id],
        ).catch(() => undefined);

        const deleteFile = vi.fn().mockResolvedValue(undefined);
        expect(await service.delete(id, { deleteFile })).toBe(true);

        expect(deleteFile.mock.calls.map((c) => c[0])).toEqual(['folder-1', 'cvfile1']);
        expect(await models.Candidate.findById(id)).toBeNull();
        expect(await models.CandidateAvatar.countDocuments({ candidate_id: id })).toBe(0);
        expect(await models.CandidateHistory.countDocuments({ candidate_id: id })).toBe(0);
        expect(await models.Notification.countDocuments({ link: `/rh/candidats/${id}` })).toBe(0);
        expect((await models.Alternant.findById(`a-${id}`).lean())?.candidate_id).toBeNull();
        const stored = await models.Offer.findById(offer._id).lean();
        expect(stored?.matching.candidates.find((c: any) => c.id === id)).toBeUndefined();
        const access = await query<unknown[]>('SELECT 1 FROM external_access WHERE external_id = ?', [id]);
        expect(access).toHaveLength(0);
    });

    it('tolerates Drive 404 (already deleted)', async () => {
        const id = await seedCandidate('404', { drive_folder_id: 'gone' });
        const deleteFile = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 404 }));
        expect(await service.delete(id, { deleteFile })).toBe(true);
    });

    it('aborts and keeps the candidate when Drive fails', async () => {
        const id = await seedCandidate('500', { drive_folder_id: 'folder-x' });
        const deleteFile = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: 500 }));
        await expect(service.delete(id, { deleteFile })).rejects.toThrow('boom');
        expect(await getModels().Candidate.findById(id)).not.toBeNull();
    });

    it('aborts when Drive data exists but Drive is not connected', async () => {
        const id = await seedCandidate('nodrive', { drive_folder_id: 'folder-y' });
        await expect(service.delete(id, null)).rejects.toThrow(/Drive/);
        expect(await getModels().Candidate.findById(id)).not.toBeNull();
    });

    it('deletes a candidate without Drive data and without Drive access', async () => {
        const id = await seedCandidate('plain');
        expect(await service.delete(id)).toBe(true);
    });
});
