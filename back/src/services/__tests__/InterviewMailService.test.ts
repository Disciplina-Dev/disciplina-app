import { describe, it, expect, vi } from 'vitest';
import { InterviewMailService } from '../InterviewMailService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { NO_REPLY_ADDRESS } from '../../external/google/no-reply';
import { UserService } from '../UserService';
import { MailTemplateService } from '../MailTemplateService';
import { INTERVIEW_INVITATION_SUBJECT, INTERVIEW_INVITATION_BODY } from '../interviewInvitationTemplate';

const RH = { id: 7, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };

function buildMocks(overrides?: { template?: { subject: string; body: string } | null }) {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const gmailService = { sendEmail } as unknown as GoogleGmailService;
    const userService = { findByEmail: vi.fn().mockResolvedValue(RH) } as unknown as UserService;
    const mailTemplateService = {
        getSignatureHtml: vi.fn().mockResolvedValue('<br/><img alt="signature"/>'),
        findRhTemplateByKind: vi.fn().mockResolvedValue(overrides?.template ?? null),
    } as unknown as MailTemplateService;
    const service = new InterviewMailService(gmailService, userService, mailTemplateService);
    return { sendEmail, mailTemplateService, service };
}

function sentHtml(sendEmail: ReturnType<typeof vi.fn>) {
    return sendEmail.mock.calls[0][1] as { subject: string; html: string; to: string };
}

describe('InterviewMailService.sendInvitation', () => {
    it('uses the system template (kind interview_invitation) and resolves placeholders', async () => {
        const { sendEmail, mailTemplateService, service } = buildMocks({
            template: {
                subject: 'Custom interview subject',
                body: 'Hello {{company_name}}, link {{link}}, code {{code}}, {{hr_signature}}',
            },
        });

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme & Co', 'sig-value');

        expect(mailTemplateService.findRhTemplateByKind).toHaveBeenCalledWith('interview_invitation');
        const { subject, html, to } = sentHtml(sendEmail);
        expect(to).toBe('candidate@test.local');
        expect(subject).toBe('Custom interview subject');
        expect(html).toContain('Acme &amp; Co');
        expect(html).toContain('/external/authenticate?sig=sig-value');
        expect(html).toContain('#60207E');
        expect(html).toContain('<img alt="signature"/>');
    });

    it('strips a {{code}} left by an edited template (code is sent at page load)', async () => {
        const { sendEmail, service } = buildMocks({
            template: {
                subject: 'Custom interview subject',
                body: 'Hello {{company_name}}, code {{code}}, link {{link}}',
            },
        });

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        const { subject, html } = sentHtml(sendEmail);
        expect(subject).toBe('Custom interview subject');
        expect(html).not.toContain('{{code}}');
        expect(html).toContain('/external/authenticate?sig=sig-value');
    });

    it('fallbacks to the default subject/body when no template exists', async () => {
        const { sendEmail, service } = buildMocks({ template: null });

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        const { subject, html } = sentHtml(sendEmail);
        expect(subject).toBe(INTERVIEW_INVITATION_SUBJECT);
        expect(html).toContain('#60207E');
        expect(html).toContain('Choisir mon créneau');
        expect(html).toContain('/external/authenticate?sig=sig-value');
        expect(html).toContain('Acme');
    });

    it('appends the booking button when an edited template drops {{link}}', async () => {
        const { sendEmail, service } = buildMocks({
            template: { subject: 'Custom interview subject', body: 'Rendez-vous uniquement' },
        });

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        const { html } = sentHtml(sendEmail);
        expect(html).toContain('#60207E');
        expect(html).toContain('Choisir mon créneau');
        expect(html).toContain('/external/authenticate?sig=sig-value');
        expect(html).toContain('Rendez-vous uniquement');
    });

    it('appends the RH signature to the candidate invitation mail', async () => {
        const { sendEmail, mailTemplateService, service } = buildMocks();

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        expect(mailTemplateService.getSignatureHtml).toHaveBeenCalledWith(RH.id, 'rh');
        const { html } = sentHtml(sendEmail);
        expect(html).toContain('<img alt="signature"/>');
    });

    it('sends without a signature block when the user has none configured', async () => {
        const sendEmail = vi.fn().mockResolvedValue(undefined);
        const gmailService = { sendEmail } as unknown as GoogleGmailService;
        const userService = { findByEmail: vi.fn().mockResolvedValue(RH) } as unknown as UserService;
        const mailTemplateService = {
            getSignatureHtml: vi.fn().mockResolvedValue(''),
            findRhTemplateByKind: vi.fn().mockResolvedValue(null),
        } as unknown as MailTemplateService;
        const service = new InterviewMailService(gmailService, userService, mailTemplateService);

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        const { html } = sentHtml(sendEmail);
        expect(html).not.toContain('<img');
    });

    it('contains the default body placeholders documented for the editor', () => {
        expect(INTERVIEW_INVITATION_BODY).toContain('{{company_name}}');
        expect(INTERVIEW_INVITATION_BODY).toContain('{{link}}');
        expect(INTERVIEW_INVITATION_BODY).not.toContain('{{code}}');
        expect(INTERVIEW_INVITATION_BODY).toContain('{{hr_signature}}');
    });

    it('marks the invitation as no-reply (active in NODE_ENV=test)', async () => {
        const { sendEmail, service } = buildMocks();

        await service.sendInvitation(RH.email, 'candidate@test.local', 'Acme', 'sig-value');

        const options = sendEmail.mock.calls[0][1] as { replyTo?: string };
        expect(options.replyTo).toBe(NO_REPLY_ADDRESS);
    });
});