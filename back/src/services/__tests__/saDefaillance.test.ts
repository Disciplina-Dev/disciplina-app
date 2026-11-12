import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spyOnGoogleMail } from '../../../test/helpers/googleMail';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { SaDefaillanceService, DEFAILLANCE_ALERT_DAYS, DEFAILLANCE_ESCALATION_DAYS } from '../SaDefaillanceService';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createUser(suffix: string, roleId: number, permissionId: number, connected: boolean): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `${suffix}@test.local`,
        first_name: suffix,
        last_name: 'Test',
        password: 'hashed',
        role_id: roleId,
        permission_id: permissionId,
        sectors: null,
        oauth_token: connected ? 'oauth-tok' : null,
        refresh_token: connected ? 'refresh-tok' : null,
    });
}

async function seedAlternant(suffix: number, mentorEmail: string | null = 'mentor@entreprise.test'): Promise<string> {
    const repo = new AlternantRepository();
    const created = await repo.create({
        first_name: `SA-Def-${suffix}`,
        last_name: 'Test',
        session: `SIO-${suffix}`,
        session_id: null,
        email: `sa-def-${suffix}@test.local`,
        phone: null,
        candidate_id: null,
        company: {
            name: `Entreprise ${suffix}`,
            address: null,
            mentor_name: 'Jean Mentor',
            mentor_email: mentorEmail,
            start_date: new Date(),
            end_date: null,
        },
        linked_alternant_ids: [],
    } as any);
    return created._id;
}

describe('SaDefaillanceService', () => {
    let sendEmail: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();
        await (await import('../../db/mongo/tenant')).getModels().Notification.deleteMany({});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('report() envoie tout de suite un rappel écrit au mentor (#961)', async () => {
        const suffix = Date.now();
        await createUser(`peda-${suffix}`, 3, 1, true); // PEDA, EMPLOYEE, connecté
        const alternantId = await seedAlternant(suffix);

        const defaillance = await new SaDefaillanceService().report(alternantId, 'Aucune réponse depuis 3 semaines');

        expect(defaillance.reason).toBe('Aucune réponse depuis 3 semaines');
        expect(defaillance.reminder_sent_at).toBeInstanceOf(Date);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0] as unknown as [any, { to: string; subject: string }];
        expect(options.to).toBe('mentor@entreprise.test');

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.defaillance?.reported_at).toBeInstanceOf(Date);
        expect(updated?.defaillance?.resolved_at ?? null).toBeNull();
    });

    it('run() envoie le courrier d’alerte (Responsable) à J+7, pas avant', async () => {
        const suffix = Date.now() + 1;
        await createUser(`responsable-${suffix}`, 3, 2, true); // PEDA, RESPONSABLE, connecté
        const alternantId = await seedAlternant(suffix);

        const reportedAt = new Date(Date.now() - (DEFAILLANCE_ALERT_DAYS + 1) * DAY_MS);
        await new AlternantRepository().setDefaillance(alternantId, {
            reason: 'Mentor injoignable',
            reported_at: reportedAt,
            reminder_sent_at: reportedAt,
            alert_sent_at: null,
            escalated_at: null,
            resolved_at: null,
        });

        const { alerted, escalated } = await new SaDefaillanceService().run();
        expect(alerted).toBe(1);
        expect(escalated).toBe(0);
        expect(sendEmail).toHaveBeenCalledTimes(1);

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.defaillance?.alert_sent_at).toBeInstanceOf(Date);
    });

    it('run() informe Direction et Commercial à J+14, pas avant', async () => {
        const suffix = Date.now() + 2;
        const adId = await createUser(`direction-${suffix}`, 4, 1, false); // AD
        const commercialId = await createUser(`commercial-${suffix}`, 1, 1, false); // COMMERCIAL
        const alternantId = await seedAlternant(suffix);

        const reportedAt = new Date(Date.now() - (DEFAILLANCE_ESCALATION_DAYS + 1) * DAY_MS);
        const alertAt = new Date(Date.now() - (DEFAILLANCE_ALERT_DAYS + 1) * DAY_MS);
        await new AlternantRepository().setDefaillance(alternantId, {
            reason: 'Toujours aucune réponse',
            reported_at: reportedAt,
            reminder_sent_at: reportedAt,
            alert_sent_at: alertAt,
            escalated_at: null,
            resolved_at: null,
        });

        const { escalated } = await new SaDefaillanceService().run();
        expect(escalated).toBe(1);

        const notifications = new NotificationRepository();
        const adNotifs = await notifications.findForUser(adId);
        const commercialNotifs = await notifications.findForUser(commercialId);
        expect(adNotifs.some((n) => n.type === 'company_defaillante_escalated')).toBe(true);
        expect(commercialNotifs.some((n) => n.type === 'company_defaillante_escalated')).toBe(true);

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.defaillance?.escalated_at).toBeInstanceOf(Date);
    });

    it('resolve() stoppe toute escalade ultérieure', async () => {
        const suffix = Date.now() + 3;
        await createUser(`responsable2-${suffix}`, 3, 2, true);
        const alternantId = await seedAlternant(suffix);

        const reportedAt = new Date(Date.now() - (DEFAILLANCE_ESCALATION_DAYS + 1) * DAY_MS);
        await new AlternantRepository().setDefaillance(alternantId, {
            reason: 'Problème résolu depuis',
            reported_at: reportedAt,
            reminder_sent_at: reportedAt,
            alert_sent_at: null,
            escalated_at: null,
            resolved_at: null,
        });

        expect(await new SaDefaillanceService().resolve(alternantId)).toBe(true);

        const { alerted, escalated } = await new SaDefaillanceService().run();
        expect(alerted).toBe(0);
        expect(escalated).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("ne tente rien si aucune défaillance n'est en cours (resolve)", async () => {
        const suffix = Date.now() + 4;
        const alternantId = await seedAlternant(suffix);
        expect(await new SaDefaillanceService().resolve(alternantId)).toBe(false);
    });
});
