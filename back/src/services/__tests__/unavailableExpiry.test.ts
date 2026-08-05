import { describe, it, expect, beforeEach } from 'vitest';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { CandidateService } from '../CandidateService';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';

async function createRhUser(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `rh-unavail-${suffix}@test.local`,
        first_name: 'RH',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 2 as any,
        permission_id: 1 as any,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function seedUnavailable(suffix: number, availabilityDate: Date | undefined): Promise<string> {
    const repo = new CandidateRepository();
    const id = `cand-unavail-${suffix}`;
    await repo.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.UNAVAILABLE,
        identity: {
            full_name: `Candidat ${suffix}`,
            email: `cand-${suffix}@test.local`,
            phone: '0692000000',
        } as any,
        job_info: { availability_date: availabilityDate } as any,
    });
    return id;
}

describe('CandidateService.processExpiredUnavailable', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
    });

    it('repasse en recherche et notifie les RH quand la date de disponibilité est atteinte', async () => {
        const suffix = Date.now();
        const rhId = await createRhUser(suffix);
        const id = await seedUnavailable(suffix, new Date(Date.now() - 24 * 60 * 60 * 1000));

        const reverted = await new CandidateService().processExpiredUnavailable();
        expect(reverted).toBe(1);

        const candidate = await new CandidateRepository().findById(id);
        expect(candidate?.status).toBe(CandidateStatus.SEEKING);

        const notifications = await new NotificationRepository().findForUser(rhId);
        const notif = notifications.find((n) => n.type === 'candidate_available_again');
        expect(notif).toBeDefined();
        expect(notif?.message).toContain(`Candidat ${suffix}`);
    });

    it('ne bascule pas un candidat dont la date de disponibilité est future', async () => {
        const suffix = Date.now() + 1;
        await createRhUser(suffix);
        const id = await seedUnavailable(suffix, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        expect(await new CandidateService().processExpiredUnavailable()).toBe(0);
        const candidate = await new CandidateRepository().findById(id);
        expect(candidate?.status).toBe(CandidateStatus.UNAVAILABLE);
    });

    it('ne bascule (et ne notifie) qu’une seule fois — dédup', async () => {
        const suffix = Date.now() + 2;
        await createRhUser(suffix);
        await seedUnavailable(suffix, new Date(Date.now() - 24 * 60 * 60 * 1000));

        const service = new CandidateService();
        expect(await service.processExpiredUnavailable()).toBe(1);
        expect(await service.processExpiredUnavailable()).toBe(0);
    });
});
