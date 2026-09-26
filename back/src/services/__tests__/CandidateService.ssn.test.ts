import { describe, it, expect } from 'vitest';
import { CandidateService } from '../CandidateService';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';
import { MASKED_SSN } from '../../external/crypto/ssn-cipher';

describe('CandidateService SSN encryption', () => {
    const service = new CandidateService();

    it('encrypts a plaintext social_security_number on create', async () => {
        const suffix = Date.now();
        const id = `ssn-create-${suffix}`;

        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Ssn Create ${suffix}`,
                email: `ssn-create-${suffix}@test.local`,
                phone: '0100000020',
                social_security_number: '123456789012345',
            } as any,
        } as any);

        const stored = await CandidateModel.findById(id).lean();
        const ssn = stored?.identity.social_security_number as any;

        expect(ssn).toBeTypeOf('object');
        expect(ssn.encrypted).toBeTypeOf('string');
        expect(ssn.iv).toBeTypeOf('string');
        expect(ssn.tag).toBeTypeOf('string');
        expect(ssn.encrypted).not.toBe('123456789012345');
    });

    it('leaves an already-encrypted social_security_number untouched on a no-op update', async () => {
        const suffix = Date.now();
        const id = `ssn-noop-${suffix}`;

        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Ssn Noop ${suffix}`,
                email: `ssn-noop-${suffix}@test.local`,
                phone: '0100000021',
                social_security_number: '111223334445555',
            } as any,
        } as any);

        const before = await CandidateModel.findById(id).lean();

        await service.update(id, { status: CandidateStatus.CONTRACT });

        const after = await CandidateModel.findById(id).lean();

        expect(after?.identity.social_security_number).toEqual(before?.identity.social_security_number);
    });

    it('re-encrypts when a new plaintext social_security_number is submitted on update', async () => {
        const suffix = Date.now();
        const id = `ssn-update-${suffix}`;

        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Ssn Update ${suffix}`,
                email: `ssn-update-${suffix}@test.local`,
                phone: '0100000022',
                social_security_number: '999888777666555',
            } as any,
        } as any);

        const before = await CandidateModel.findById(id).lean();

        await service.update(id, { identity: { social_security_number: '555666777888999' } as any });

        const after = await CandidateModel.findById(id).lean();
        const afterSsn = after?.identity.social_security_number as any;

        expect(afterSsn).not.toEqual(before?.identity.social_security_number);
        expect(afterSsn.encrypted).not.toBe('555666777888999');
    });

    it('ignores the masked placeholder resubmitted on update, keeping the real encrypted value', async () => {
        const suffix = Date.now();
        const id = `ssn-masked-${suffix}`;

        await service.create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: `Ssn Masked ${suffix}`,
                email: `ssn-masked-${suffix}@test.local`,
                phone: '0100000023',
                social_security_number: '444555666777888',
            } as any,
        } as any);

        const before = await CandidateModel.findById(id).lean();

        await service.update(id, {
            identity: { full_name: `Ssn Masked Renamed ${suffix}`, social_security_number: MASKED_SSN } as any,
        });

        const after = await CandidateModel.findById(id).lean();

        expect(after?.identity.social_security_number).toEqual(before?.identity.social_security_number);
        expect(after?.identity.full_name).toBe(`Ssn Masked Renamed ${suffix}`);
    });
});
