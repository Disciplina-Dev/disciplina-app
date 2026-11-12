import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spyOnGoogleMail } from '../../../test/helpers/googleMail';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../../repositories/mongo/AlternantSequenceRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { AlternantSequenceStatus } from '../../types/alternant.types';
import { SaAppointmentService, SA_APPOINTMENT_WINDOW_MIN_DAYS } from '../SaAppointmentService';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createPedaUser(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `peda-sa-appt-${suffix}@test.local`,
        first_name: 'Peda',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 3, // PEDA
        permission_id: 1, // EMPLOYEE
        sectors: null,
        oauth_token: 'oauth-tok',
        refresh_token: 'refresh-tok',
    });
}

async function seedAlternant(suffix: number, mentorEmail: string | null): Promise<string> {
    const repo = new AlternantRepository();
    const created = await repo.create({
        first_name: `SA-Appt-${suffix}`,
        last_name: 'Test',
        session: `SIO-${suffix}`,
        session_id: null,
        email: `sa-appt-${suffix}@test.local`,
        phone: null,
        candidate_id: null,
        company: {
            name: 'Acme SARL',
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

async function seedSequence(alternantId: string, numero: number, prevueLe: Date): Promise<{ _id: string }> {
    const repo = new AlternantSequenceRepository();
    return repo.create({
        alternant_id: alternantId,
        numero,
        prevue_le: prevueLe,
        status: AlternantSequenceStatus.PENDING,
        contacts: { mentor: false, alternant: false, formateur: false },
        auto_generated: false,
    } as any);
}

describe('SaAppointmentService', () => {
    let sendEmail: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propose une date de RDV au mentor pour une SA à 2-3 semaines, avec un lien de confirmation (#961)', async () => {
        const suffix = Date.now();
        await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix, 'mentor@entreprise.test');
        const dueDate = new Date(Date.now() + (SA_APPOINTMENT_WINDOW_MIN_DAYS + 1) * DAY_MS);
        const seq = await seedSequence(alternantId, 1, dueDate);

        const { proposed } = await new SaAppointmentService().run();
        expect(proposed).toBe(1);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0] as unknown as [any, { to: string; subject: string; html: string }];
        expect(options.to).toBe('mentor@entreprise.test');
        expect(options.html).toContain('SA-Appt');
        expect(options.html).toContain('sa-appointment/response');
        expect(options.html).toContain(`id=${seq._id}`);

        const updated = await new AlternantSequenceRepository().findById(seq._id);
        expect(updated?.appointment_proposed_at).toBeInstanceOf(Date);
    });

    it('ne propose pas deux fois (dédup via appointment_proposed_at)', async () => {
        const suffix = Date.now() + 1;
        await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix, 'mentor@entreprise.test');
        const dueDate = new Date(Date.now() + (SA_APPOINTMENT_WINDOW_MIN_DAYS + 1) * DAY_MS);
        await seedSequence(alternantId, 1, dueDate);

        const service = new SaAppointmentService();
        expect(await service.run()).toEqual({ proposed: 1 });
        expect(await service.run()).toEqual({ proposed: 0 });
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("n'envoie rien si le mentor n'a pas d'email renseigné", async () => {
        const suffix = Date.now() + 2;
        await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix, null);
        const dueDate = new Date(Date.now() + (SA_APPOINTMENT_WINDOW_MIN_DAYS + 1) * DAY_MS);
        await seedSequence(alternantId, 1, dueDate);

        const { proposed } = await new SaAppointmentService().run();
        expect(proposed).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('ignore les SA hors fenêtre de 14 à 21 jours', async () => {
        const suffix = Date.now() + 3;
        await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix, 'mentor@entreprise.test');
        await seedSequence(alternantId, 1, new Date(Date.now() + 5 * DAY_MS)); // trop tôt
        await seedSequence(alternantId, 2, new Date(Date.now() + 30 * DAY_MS)); // trop tard

        const { proposed } = await new SaAppointmentService().run();
        expect(proposed).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('confirm() marque le rendez-vous comme confirmé', async () => {
        const suffix = Date.now() + 4;
        const alternantId = await seedAlternant(suffix, 'mentor@entreprise.test');
        const seq = await seedSequence(alternantId, 1, new Date(Date.now() + 15 * DAY_MS));

        const confirmed = await new SaAppointmentService().confirm(seq._id);
        expect(confirmed).toBe(true);

        const updated = await new AlternantSequenceRepository().findById(seq._id);
        expect(updated?.appointment_confirmed_at).toBeInstanceOf(Date);
    });

    it('confirm() renvoie false pour une séquence inconnue', async () => {
        expect(await new SaAppointmentService().confirm('does-not-exist')).toBe(false);
    });
});
