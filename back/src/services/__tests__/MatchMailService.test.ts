import { describe, it, expect, vi } from 'vitest';
import { MatchMailService } from '../MatchMailService';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { UserService } from '../UserService';
import { MailTemplateService } from '../MailTemplateService';

function stubDeps(rh: { id: number; email: string; oauthToken: string | null; refreshToken: string | null }) {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const gmailService = { sendEmail } as unknown as GoogleGmailService;
    const userService = {
        findByEmail: vi.fn().mockResolvedValue({ ...rh, firstName: 'Jean', lastName: 'Martin' }),
    } as unknown as UserService;
    return { sendEmail, gmailService, userService };
}

describe('MatchMailService.sendInvitation', () => {
    it('sends the matching invitation with the access link and RH signature', async () => {
        const rh = { id: 42, email: 'rh@test.local', oauthToken: 'tok', refreshToken: 'rtok' };
        const { sendEmail, gmailService, userService } = stubDeps(rh);
        const mailTemplateService = {
            findById: vi.fn().mockResolvedValue(null),
            findRhTemplateByKind: vi.fn().mockResolvedValue(null),
            getSignatureHtml: vi.fn().mockResolvedValue('<br/><img alt="signature"/>'),
        } as unknown as MailTemplateService;

        const service = new MatchMailService(gmailService, userService, mailTemplateService);
        await service.sendInvitation({
            signature: 'sig',
            link: 'https://app.test/external/authenticate?sig=sig',
            rhEmail: rh.email,
            companyEmail: 'company@test.local',
        });

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0];
        expect(options.html).toContain('https://app.test/external/authenticate?sig=sig');
        expect(options.html).toContain('<img alt="signature"/>');
    });
});
