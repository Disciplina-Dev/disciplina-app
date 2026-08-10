import { describe, it, expect, beforeEach } from 'vitest';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { ImmersionEndNotificationService } from '../ImmersionEndNotificationService';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';

async function createRhUser(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `rh-immersion-${suffix}@test.local`,
        first_name: 'RH',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 2,
        permission_id: 1,
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function seedCandidate(
    suffix: number,
    immersionEndDate: Date | undefined,
    company = 'Boulangerie Test',
): Promise<string> {
    const repo = new CandidateRepository();
    const id = `cand-immersion-${suffix}`;
    await repo.create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.IMMERSING,
        identity: {
            full_name: `Candidat ${suffix}`,
            email: `cand-${suffix}@test.local`,
            phone: '0692000000',
        } as any,
        immersion_company_name: company,
        immersion_end_date: immersionEndDate,
    });
    return id;
}

describe('ImmersionEndNotificationService', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
    });

    it('notifie l’équipe RH quand une immersion est terminée', async () => {
        const suffix = Date.now();
        const rhId = await createRhUser(suffix);
        await seedCandidate(suffix, new Date(Date.now() - 24 * 60 * 60 * 1000));

        const count = await new ImmersionEndNotificationService().run();
        expect(count).toBe(1);

        const notifications = await new NotificationRepository().findForUser(rhId);
        const notif = notifications.find((n) => n.type === 'immersion_ended');
        expect(notif).toBeDefined();
        expect(notif?.message).toContain(`Candidat ${suffix}`);
        expect(notif?.message).toContain('Boulangerie Test');
    });

    it('ne re-notifie pas une immersion déjà notifiée (dédup)', async () => {
        const suffix = Date.now() + 1;
        await createRhUser(suffix);
        await seedCandidate(suffix, new Date(Date.now() - 24 * 60 * 60 * 1000));

        const service = new ImmersionEndNotificationService();
        expect(await service.run()).toBe(1);
        expect(await service.run()).toBe(0);
    });

    it('ignore une immersion pas encore terminée', async () => {
        const suffix = Date.now() + 2;
        await createRhUser(suffix);
        await seedCandidate(suffix, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        expect(await new ImmersionEndNotificationService().run()).toBe(0);
    });
});
