import { describe, it, expect, beforeEach } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { getModels } from '../../db/mongo/tenant';
import { AlternantMentorChangeService } from '../AlternantMentorChangeService';

async function createResponsablePeda(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `responsable-mentor-${suffix}@test.local`,
        first_name: 'Responsable',
        last_name: String(suffix),
        password: 'hashed',
        role_id: 3, // PEDA
        permission_id: 2, // RESPONSABLE
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function seedAlternant(suffix: number): Promise<string> {
    const repo = new AlternantRepository();
    const created = await repo.create({
        first_name: `SA-Mentor-${suffix}`,
        last_name: 'Test',
        session: `SIO-${suffix}`,
        session_id: null,
        email: `sa-mentor-${suffix}@test.local`,
        phone: null,
        candidate_id: null,
        company: {
            name: `Entreprise ${suffix}`,
            address: null,
            mentor_name: 'Jean Ancien',
            mentor_email: 'ancien@entreprise.test',
            start_date: new Date(),
            end_date: null,
        },
        linked_alternant_ids: [],
    } as any);
    return created._id;
}

describe('AlternantMentorChangeService', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
        await getModels().Notification.deleteMany({});
    });

    it('déclare le changement, applique le nouveau mentor et notifie la Responsable (#961)', async () => {
        const suffix = Date.now();
        const responsableId = await createResponsablePeda(suffix);
        const alternantId = await seedAlternant(suffix);

        const change = await new AlternantMentorChangeService().declare(
            alternantId,
            'Marie Nouvelle',
            'nouvelle@entreprise.test',
        );

        expect(change.previous_mentor_name).toBe('Jean Ancien');
        expect(change.new_mentor_name).toBe('Marie Nouvelle');
        expect(change.avenant_signed_at ?? null).toBeNull();
        expect(change.opco_declared_at ?? null).toBeNull();

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.company?.mentor_name).toBe('Marie Nouvelle');
        expect(updated?.company?.mentor_email).toBe('nouvelle@entreprise.test');
        expect(updated?.mentor_changes).toHaveLength(1);

        const notifications = await new NotificationRepository().findForUser(responsableId);
        expect(notifications.some((n) => n.type === 'mentor_change_declared')).toBe(true);
    });

    it("marque l'avenant signé et la déclaration OPCO séparément, sur le dernier changement", async () => {
        const suffix = Date.now() + 1;
        const alternantId = await seedAlternant(suffix);
        const service = new AlternantMentorChangeService();
        await service.declare(alternantId, 'Marie Nouvelle', 'nouvelle@entreprise.test');

        expect(await service.markAvenantSigned(alternantId)).toBe(true);
        let updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.mentor_changes?.[0]?.avenant_signed_at).toBeInstanceOf(Date);
        expect(updated?.mentor_changes?.[0]?.opco_declared_at ?? null).toBeNull();

        expect(await service.markOpcoDeclared(alternantId)).toBe(true);
        updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.mentor_changes?.[0]?.opco_declared_at).toBeInstanceOf(Date);
    });

    it("garde l'historique sur un deuxième changement, sans toucher au premier", async () => {
        const suffix = Date.now() + 2;
        const alternantId = await seedAlternant(suffix);
        const service = new AlternantMentorChangeService();
        await service.declare(alternantId, 'Marie Nouvelle', 'nouvelle@entreprise.test');
        await service.markAvenantSigned(alternantId);
        await service.markOpcoDeclared(alternantId);

        await service.declare(alternantId, 'Paul Suivant', 'paul@entreprise.test');

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.mentor_changes).toHaveLength(2);
        expect(updated?.mentor_changes?.[0]?.new_mentor_name).toBe('Marie Nouvelle');
        expect(updated?.mentor_changes?.[0]?.opco_declared_at).toBeInstanceOf(Date);
        expect(updated?.mentor_changes?.[1]?.previous_mentor_name).toBe('Marie Nouvelle');
        expect(updated?.mentor_changes?.[1]?.opco_declared_at ?? null).toBeNull();
    });

    it('renvoie false sans changement déclaré', async () => {
        const suffix = Date.now() + 3;
        const alternantId = await seedAlternant(suffix);
        expect(await new AlternantMentorChangeService().markAvenantSigned(alternantId)).toBe(false);
    });

    it('refuse de déclarer un changement sans entreprise', async () => {
        const suffix = Date.now() + 4;
        const repo = new AlternantRepository();
        const created = await repo.create({
            first_name: `SA-NoCo-${suffix}`,
            last_name: 'Test',
            session: `SIO-${suffix}`,
            session_id: null,
            email: null,
            phone: null,
            candidate_id: null,
            company: null,
            linked_alternant_ids: [],
        } as any);

        await expect(new AlternantMentorChangeService().declare(created._id, 'X', 'x@test.local')).rejects.toThrow();
    });
});
