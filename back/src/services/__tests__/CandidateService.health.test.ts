import { describe, it, expect } from 'vitest';
import { CandidateService } from '../CandidateService';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';
import { candidateToGql } from '../mappers/candidate.mapper';
import { isEncryptedHealth } from '../../external/crypto/health-cipher';

const contact = {
    last_name: 'Doe',
    first_name: 'Jane',
    relationship: 'Mère',
    phone: '0600000000',
    email: 'j@test.local',
};

function base(id: string, extra: Record<string, unknown> = {}): any {
    return {
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.AD],
        status: CandidateStatus.SEEKING,
        identity: { full_name: id, email: `${id}@test.local`, phone: '0100000030', psh_referral_request: true },
        synthesis: { special_needs: 'Poste adapté', pedagogical_recommendations: { psh_specific_support: false } },
        emergency_contact: contact,
        ...extra,
    };
}

describe('CandidateService health-data encryption', () => {
    const service = new CandidateService();

    it('stores psh_*, special_needs and emergency_contact encrypted, and the mapper returns plaintext', async () => {
        const id = `health-create-${Date.now()}`;
        await service.create(base(id));

        const stored = (await CandidateModel.findById(id).lean()) as any;
        expect(isEncryptedHealth(stored.identity.psh_referral_request)).toBe(true);
        expect(isEncryptedHealth(stored.synthesis.special_needs)).toBe(true);
        expect(isEncryptedHealth(stored.synthesis.pedagogical_recommendations.psh_specific_support)).toBe(true);
        expect(isEncryptedHealth(stored.emergency_contact)).toBe(true);
        expect(JSON.stringify(stored)).not.toContain('Poste adapté');
        expect(JSON.stringify(stored)).not.toContain('0600000000');

        const gql = candidateToGql(stored);
        expect(gql.identity.pshReferralRequest).toBe(true);
        expect(gql.synthesis.specialNeeds).toBe('Poste adapté');
        expect(gql.synthesis.pedagogicalRecommendations.pshSpecificSupport).toBe(false);
        expect(gql.emergencyContact).toEqual({
            lastName: 'Doe',
            firstName: 'Jane',
            relationship: 'Mère',
            phone: '0600000000',
            email: 'j@test.local',
        });
    });

    it('leaves stored ciphertext untouched on an unrelated update', async () => {
        const id = `health-noop-${Date.now()}`;
        await service.create(base(id));
        const before = (await CandidateModel.findById(id).lean()) as any;

        await service.update(id, { status: CandidateStatus.CONTRACT });

        const after = (await CandidateModel.findById(id).lean()) as any;
        expect(after.emergency_contact).toBe(before.emergency_contact);
        expect(after.identity.psh_referral_request).toBe(before.identity.psh_referral_request);
        expect(after.synthesis.special_needs).toBe(before.synthesis.special_needs);
    });

    it('encrypts a changed value on update and merges a partial emergency_contact', async () => {
        const id = `health-update-${Date.now()}`;
        await service.create(base(id));

        await service.update(id, {
            synthesis: { special_needs: 'Autre besoin' },
            emergency_contact: { phone: '0700000000' },
        } as any);

        const stored = (await CandidateModel.findById(id).lean()) as any;
        expect(isEncryptedHealth(stored.synthesis.special_needs)).toBe(true);
        const gql = candidateToGql(stored);
        expect(gql.synthesis.specialNeeds).toBe('Autre besoin');
        expect(gql.emergencyContact).toMatchObject({ lastName: 'Doe', phone: '0700000000' });
    });

    it('still reads a legacy plaintext document (before backfill)', async () => {
        const id = `health-legacy-${Date.now()}`;
        await CandidateModel.collection.insertOne(base(id) as any);

        const stored = (await CandidateModel.findById(id).lean()) as any;
        const gql = candidateToGql(stored);
        expect(gql.identity.pshReferralRequest).toBe(true);
        expect(gql.synthesis.specialNeeds).toBe('Poste adapté');
        expect(gql.emergencyContact.lastName).toBe('Doe');
    });
});
