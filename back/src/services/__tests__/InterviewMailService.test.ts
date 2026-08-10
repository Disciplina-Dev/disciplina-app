import { describe, it, expect, vi } from 'vitest';
import { InterviewMailService } from '../InterviewMailService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { UserService } from '../UserService';
import { MailTemplateService } from '../MailTemplateService';

describe('InterviewMailService.sendInvitation', () => {
    it('appends the RH signature to the candidate invitation mail', async () => {
        const rh = { id: 7, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };
        const sendEmail = vi.fn().mockResolvedValue(undefined);
        const gmailService = { sendEmail } as unknown as GoogleGmailService;
        const userService = { findByEmail: vi.fn().mockResolvedValue(rh) } as unknown as UserService;
        const getSignatureHtml = vi.fn().mockResolvedValue('<br/><img alt="signature"/>');
        const mailTemplateService = { getSignatureHtml } as unknown as MailTemplateService;

        const service = new InterviewMailService(gmailService, userService, mailTemplateService);
        await service.sendInvitation(rh.email, 'candidate@test.local', 'Acme', 'sig-value', '123456');

        expect(getSignatureHtml).toHaveBeenCalledWith(rh.id, 'rh');
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toContain('<img alt="signature"/>');
    });

    it('sends without a signature block when the user has none configured', async () => {
        const rh = { id: 7, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };
        const sendEmail = vi.fn().mockResolvedValue(undefined);
        const gmailService = { sendEmail } as unknown as GoogleGmailService;
        const userService = { findByEmail: vi.fn().mockResolvedValue(rh) } as unknown as UserService;
        const mailTemplateService = {
            getSignatureHtml: vi.fn().mockResolvedValue(''),
        } as unknown as MailTemplateService;

        const service = new InterviewMailService(gmailService, userService, mailTemplateService);
        await service.sendInvitation(rh.email, 'candidate@test.local', 'Acme', 'sig-value', '123456');

        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).not.toContain('<img');
    });
});
