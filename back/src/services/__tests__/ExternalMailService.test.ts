import { describe, it, expect, vi } from 'vitest';
import { ExternalMailService } from '../ExternalMailService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { UserService } from '../UserService';
import { MailTemplateService } from '../MailTemplateService';

function stubDeps(rh: { id: number; email: string; oauthToken: string | null; refreshToken: string | null }) {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const gmailService = { sendEmail } as unknown as GoogleGmailService;
    const userService = { findByEmail: vi.fn().mockResolvedValue(rh) } as unknown as UserService;
    return { sendEmail, gmailService, userService };
}

describe('ExternalMailService', () => {
    const rh = { id: 9, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };

    it('sendLockAlert appends the RH signature when one is configured', async () => {
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const getSignatureHtml = vi.fn().mockResolvedValue('<br/><img alt="signature"/>');
        const mailTemplateService = { getSignatureHtml } as unknown as MailTemplateService;

        const service = new ExternalMailService(gmailService, userService, mailTemplateService);
        await service.sendLockAlert(rh.email, 'external@test.local');

        expect(getSignatureHtml).toHaveBeenCalledWith(rh.id, 'rh');
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toContain('<img alt="signature"/>');
    });

    it('sendMail appends the RH signature to the caller-supplied html', async () => {
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const getSignatureHtml = vi.fn().mockResolvedValue('<br/><img alt="signature"/>');
        const mailTemplateService = { getSignatureHtml } as unknown as MailTemplateService;

        const service = new ExternalMailService(gmailService, userService, mailTemplateService);
        await service.sendMail(rh.email, {
            to: 'candidate@test.local',
            subject: 'Import CV',
            html: '<p>Bonjour</p>',
        });

        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toBe('<p>Bonjour</p><br/><img alt="signature"/>');
    });

    it('sends without a signature block when the user has none configured', async () => {
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const mailTemplateService = {
            getSignatureHtml: vi.fn().mockResolvedValue(''),
        } as unknown as MailTemplateService;

        const service = new ExternalMailService(gmailService, userService, mailTemplateService);
        await service.sendLockAlert(rh.email, 'external@test.local');

        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).not.toContain('<img');
    });
});
