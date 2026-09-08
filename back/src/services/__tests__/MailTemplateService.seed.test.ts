import { describe, it, expect } from 'vitest';
import { MailTemplateService, INTERVIEW_INVITATION_SEEDED_KEY } from '../MailTemplateService';
import { AppSettingsRepository } from '../../repositories/mysql/AppSettingsRepository';
import { MailTemplateModel } from '../../db/mongo/schemas/mailTemplate.schema';
import { query } from '../../db/mysql/connection';

describe('MailTemplateService.seedInterviewInvitationDefault', () => {
    it('seeds the interview invitation system template (kind interview_invitation) once, then idempotently skips', async () => {
        // Flag absent + modèle absent : on repart d'un état propre.
        await query('DELETE FROM app_settings WHERE setting_key = ?', [INTERVIEW_INVITATION_SEEDED_KEY]);
        await MailTemplateModel.deleteMany({ scope: 'rh', kind: 'interview_invitation' });

        const service = new MailTemplateService();
        await service.seedInterviewInvitationDefault();
        await service.seedInterviewInvitationDefault();

        const tpl = await MailTemplateModel.findOne({ scope: 'rh', kind: 'interview_invitation' }).lean();
        expect(tpl).not.toBeNull();
        expect(tpl?.name).toBe('Invitation entretien');
        expect(tpl?.user_id).toBe(0);
        expect(tpl?.subject).toBe("[Disciplina] Choisissez votre créneau d'entretien");
        expect(String(tpl?.body)).toContain('{{company_name}}');

        const total = await MailTemplateModel.countDocuments({ scope: 'rh', kind: 'interview_invitation' });
        expect(total).toBe(1);

        const flag = await new AppSettingsRepository().get(INTERVIEW_INVITATION_SEEDED_KEY);
        expect(flag).toBe('1');
    }, 15000);
});