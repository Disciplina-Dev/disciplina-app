import { describe, it, expect, beforeEach } from 'vitest';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../../repositories/mongo/AlternantSequenceRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { SaNotificationService } from '../SaNotificationService';
import { RuptureService } from '../RuptureService';
import { AlternantSequenceStatus } from '../../types/alternant.types';
import { getModels } from '../../db/mongo/tenant';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createPedaUser(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `peda-sa-notif-${suffix}@test.local`,
        first_name: 'Peda',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 3, // PEDA
        permission_id: 1, // EMPLOYEE
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function seedAlternant(suffix: number): Promise<string> {
    const repo = new AlternantRepository();
    const created = await repo.create({
        first_name: `SA-Notif-${suffix}`,
        last_name: 'Test',
        session: `SIO-${suffix}`,
        session_id: null,
        email: `sa-notif-${suffix}@test.local`,
        phone: null,
        candidate_id: null,
        company: { name: 'Acme SARL', address: null, mentor_name: null, start_date: new Date(), end_date: null },
        linked_alternant_ids: [],
    });
    return created._id;
}

async function seedSequence(
    alternantId: string,
    numero: number,
    prevueLe: Date,
    overrides: Record<string, unknown> = {},
) {
    const repo = new AlternantSequenceRepository();
    return repo.create({
        alternant_id: alternantId,
        numero,
        prevue_le: prevueLe,
        status: AlternantSequenceStatus.PENDING,
        contacts: { mentor: false, alternant: false, formateur: false },
        auto_generated: true,
        ...overrides,
    } as any);
}

describe('SaNotificationService', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
        await getModels().Notification.deleteMany({});
        await getModels().Rupture.deleteMany({});
    });

    it('notifies Peda users when a SA first becomes En cours or En retard, then dedups', async () => {
        const suffix = Date.now();
        const pedaId = await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const now = new Date();
        await seedSequence(alternantId, 1, new Date(startOfToday.getTime() + 5 * DAY_MS)); // En cours
        await seedSequence(alternantId, 2, new Date(startOfToday.getTime() - 2 * DAY_MS)); // En retard
        await seedSequence(alternantId, 3, new Date(startOfToday.getTime() + 40 * DAY_MS)); // Hors fenêtre

        const counts = await new SaNotificationService().run(now);
        expect(counts).toEqual({ soon: 1, late: 1 });

        const notifications = await new NotificationRepository().findForUser(pedaId);
        const soon = notifications.find((n) => n.type === 'sa_soon');
        const late = notifications.find((n) => n.type === 'sa_late');
        expect(soon).toBeDefined();
        expect(soon?.category).toBe('peda');
        expect(soon?.link).toBe(`/peda/alternants/${alternantId}`);
        expect(late).toBeDefined();
        expect(late?.category).toBe('peda');
        expect(late?.link).toBe(`/peda/alternants/${alternantId}`);

        // Deuxième passage : chaque transition n'est notifiée qu'une fois.
        expect(await new SaNotificationService().run(now)).toEqual({ soon: 0, late: 0 });
    });

    it('ignores done, archived and already-realised SAs', async () => {
        const suffix = Date.now() + 1;
        await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const overdue = new Date(startOfToday.getTime() - 3 * DAY_MS);
        await seedSequence(alternantId, 1, overdue, { status: AlternantSequenceStatus.DONE });
        await seedSequence(alternantId, 2, overdue, { archived_at: new Date() });

        expect(await new SaNotificationService().run(new Date())).toEqual({ soon: 0, late: 0 });
    });

    it('notifies Peda users when a rupture is declared', async () => {
        const suffix = Date.now() + 2;
        const pedaId = await createPedaUser(suffix);
        const alternantId = await seedAlternant(suffix);

        const created = await new RuptureService().declare({
            alternantId,
            dateRupture: '2026-10-07',
            motif: "Rupture pendant les 45 premiers jours en emploi, consécutifs ou non, de l'apprenti, par ce dernier ou l'employeur (art. L. 6222-18)",
            poursuitFormation: false,
        });
        expect(created.alternant_id).toBe(alternantId);

        const notifications = await new NotificationRepository().findForUser(pedaId);
        const notif = notifications.find((n) => n.type === 'rupture_declared');
        expect(notif).toBeDefined();
        expect(notif?.category).toBe('peda');
        expect(notif?.message).toContain('quitte la formation');
        expect(notif?.link).toBe(`/peda/alternants/${alternantId}`);
    });
});
