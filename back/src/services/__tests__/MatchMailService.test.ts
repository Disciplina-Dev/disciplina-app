import { describe, it, expect, vi } from 'vitest';
import { MatchMailService } from '../MatchMailService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { UserService } from '../UserService';
import { MailTemplateService } from '../MailTemplateService';

function stubDeps(rh: { id: number; email: string; oauthToken: string | null; refreshToken: string | null }) {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const gmailService = { sendEmail } as unknown as GoogleGmailService;
    const userService = { findByEmail: vi.fn().mockResolvedValue(rh) } as unknown as UserService;
    return { sendEmail, gmailService, userService };
}

describe('MatchMailService.sendLockAlert', () => {
    it('appends the RH signature to the mail when one is configured', async () => {
        const rh = { id: 42, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const getSignatureHtml = vi.fn().mockResolvedValue('<br/><img alt="signature"/>');
        const mailTemplateService = { getSignatureHtml } as unknown as MailTemplateService;

        const service = new MatchMailService(gmailService, userService, mailTemplateService);
        await service.sendLockAlert(rh.email, 'company@test.local');

        expect(getSignatureHtml).toHaveBeenCalledWith(rh.id, 'rh');
        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toContain('<img alt="signature"/>');
    });

    it('sends without a signature block when the user has none configured', async () => {
        const rh = { id: 42, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const mailTemplateService = {
            getSignatureHtml: vi.fn().mockResolvedValue(''),
        } as unknown as MailTemplateService;

        const service = new MatchMailService(gmailService, userService, mailTemplateService);
        await service.sendLockAlert(rh.email, 'company@test.local');

        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).not.toContain('<img');
    });
});
