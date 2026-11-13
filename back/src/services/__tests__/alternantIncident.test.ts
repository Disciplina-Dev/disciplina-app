import { describe, it, expect, beforeEach } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NotificationRepository } from '../../repositories/mongo/NotificationRepository';
import { getModels } from '../../db/mongo/tenant';
import {
    AlternantIncidentService,
    INCIDENT_DECLARATION_REMINDER_HOURS,
    INCIDENT_ANALYSIS_REMINDER_DAYS,
} from '../AlternantIncidentService';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function createResponsablePeda(suffix: number): Promise<number> {
    const repo = new UserRepository();
    return repo.create({
        email: `responsable-incident-${suffix}@test.local`,
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
        first_name: `SA-Incident-${suffix}`,
        last_name: 'Test',
        session: `SIO-${suffix}`,
        session_id: null,
        email: `sa-incident-${suffix}@test.local`,
        phone: null,
        candidate_id: null,
        company: {
            name: `Entreprise ${suffix}`,
            address: null,
            mentor_name: 'Jean Mentor',
            mentor_email: 'mentor@entreprise.test',
            start_date: new Date(),
            end_date: null,
        },
        linked_alternant_ids: [],
    } as any);
    return created._id;
}

describe('AlternantIncidentService', () => {
    beforeEach(async () => {
        await truncateMysql();
        await dropMongo();
        await getModels().Notification.deleteMany({});
    });

    it('report() déclare un accident et notifie tout de suite la Responsable (#970)', async () => {
        const suffix = Date.now();
        const responsableId = await createResponsablePeda(suffix);
        const alternantId = await seedAlternant(suffix);

        const incident = await new AlternantIncidentService().report(
            alternantId,
            'Chute dans l’atelier',
            new Date('2026-01-10'),
            false,
        );

        expect(incident.description).toBe('Chute dans l’atelier');
        expect(incident.declared_by_cfa).toBe(false);
        expect(incident.declaration_done_at ?? null).toBeNull();
        expect(incident.analysis_done_at ?? null).toBeNull();

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.incidents).toHaveLength(1);

        const notifications = await new NotificationRepository().findForUser(responsableId);
        expect(notifications.some((n) => n.type === 'incident_declared')).toBe(true);
    });

    it("marque la déclaration et l'analyse séparément, sur le dernier accident", async () => {
        const suffix = Date.now() + 1;
        const alternantId = await seedAlternant(suffix);
        const service = new AlternantIncidentService();
        await service.report(alternantId, 'Accident mineur', new Date(), true);

        expect(await service.markDeclarationDone(alternantId)).toBe(true);
        let updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.incidents?.[0]?.declaration_done_at).toBeInstanceOf(Date);
        expect(updated?.incidents?.[0]?.analysis_done_at ?? null).toBeNull();

        expect(await service.markAnalysisDone(alternantId, 'Formation sécurité renforcée')).toBe(true);
        updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.incidents?.[0]?.analysis_done_at).toBeInstanceOf(Date);
        expect(updated?.incidents?.[0]?.prevention_measures).toBe('Formation sécurité renforcée');
    });

    it('run() rappelle la déclaration en retard à J+48h, pas avant', async () => {
        const suffix = Date.now() + 2;
        const responsableId = await createResponsablePeda(suffix);
        const alternantId = await seedAlternant(suffix);

        const declaredAt = new Date(Date.now() - (INCIDENT_DECLARATION_REMINDER_HOURS + 1) * HOUR_MS);
        await new AlternantRepository().declareIncident(alternantId, {
            description: 'Accident non déclaré',
            occurred_at: declaredAt,
            declared_at: declaredAt,
            declared_by_cfa: false,
            declaration_done_at: null,
            declaration_reminder_sent_at: null,
            analysis_done_at: null,
            analysis_reminder_sent_at: null,
            prevention_measures: null,
        });

        const { declarationReminders } = await new AlternantIncidentService().run();
        expect(declarationReminders).toBe(1);

        const notifications = await new NotificationRepository().findForUser(responsableId);
        expect(notifications.some((n) => n.type === 'incident_declaration_overdue')).toBe(true);

        const updated = await new AlternantRepository().findById(alternantId);
        expect(updated?.incidents?.[0]?.declaration_reminder_sent_at).toBeInstanceOf(Date);
    });

    it("run() n'envoie pas de rappel de déclaration avant J+48h", async () => {
        const suffix = Date.now() + 3;
        const alternantId = await seedAlternant(suffix);
        await new AlternantRepository().declareIncident(alternantId, {
            description: 'Accident récent',
            occurred_at: new Date(),
            declared_at: new Date(),
            declared_by_cfa: false,
            declaration_done_at: null,
            declaration_reminder_sent_at: null,
            analysis_done_at: null,
            analysis_reminder_sent_at: null,
            prevention_measures: null,
        });

        const { declarationReminders } = await new AlternantIncidentService().run();
        expect(declarationReminders).toBe(0);
    });

    it("run() rappelle l'analyse en retard à J+7, pas avant, et n'alerte plus la déclaration déjà faite", async () => {
        const suffix = Date.now() + 4;
        const responsableId = await createResponsablePeda(suffix);
        const alternantId = await seedAlternant(suffix);

        const declaredAt = new Date(Date.now() - (INCIDENT_ANALYSIS_REMINDER_DAYS + 1) * DAY_MS);
        await new AlternantRepository().declareIncident(alternantId, {
            description: 'Accident déclaré, analyse en retard',
            occurred_at: declaredAt,
            declared_at: declaredAt,
            declared_by_cfa: true,
            declaration_done_at: declaredAt,
            declaration_reminder_sent_at: null,
            analysis_done_at: null,
            analysis_reminder_sent_at: null,
            prevention_measures: null,
        });

        const { declarationReminders, analysisReminders } = await new AlternantIncidentService().run();
        expect(declarationReminders).toBe(0);
        expect(analysisReminders).toBe(1);

        const notifications = await new NotificationRepository().findForUser(responsableId);
        expect(notifications.some((n) => n.type === 'incident_analysis_overdue')).toBe(true);
    });

    it('run() ne rappelle plus un accident dont déclaration et analyse sont déjà cochées faites', async () => {
        const suffix = Date.now() + 5;
        const alternantId = await seedAlternant(suffix);

        const declaredAt = new Date(Date.now() - (INCIDENT_ANALYSIS_REMINDER_DAYS + 1) * DAY_MS);
        await new AlternantRepository().declareIncident(alternantId, {
            description: 'Accident entièrement traité',
            occurred_at: declaredAt,
            declared_at: declaredAt,
            declared_by_cfa: false,
            declaration_done_at: declaredAt,
            declaration_reminder_sent_at: null,
            analysis_done_at: declaredAt,
            analysis_reminder_sent_at: null,
            prevention_measures: 'RAS',
        });

        const { declarationReminders, analysisReminders } = await new AlternantIncidentService().run();
        expect(declarationReminders).toBe(0);
        expect(analysisReminders).toBe(0);
    });

    it('renvoie false sans accident déclaré', async () => {
        const suffix = Date.now() + 6;
        const alternantId = await seedAlternant(suffix);
        expect(await new AlternantIncidentService().markDeclarationDone(alternantId)).toBe(false);
        expect(await new AlternantIncidentService().markAnalysisDone(alternantId, null)).toBe(false);
    });
});
