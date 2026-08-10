import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { truncateMysql, dropMongo } from '../../../test/helpers/db';
import { spyOnGoogleMail } from '../../../test/helpers/googleMail';
import { UserRepository } from '../../repositories/mysql/UserRepository';
import { NeedsAnalysisRepository } from '../../repositories/mongo/NeedsAnalysisRepository';
import { NeedsAnalysisStatus } from '../../types/needsAnalysisNoSql.types';
import { AbSignatureRelanceService } from '../AbSignatureRelanceService';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

describe('AbSignatureRelanceService', () => {
    let userId: number;
    let sendEmail: ReturnType<typeof vi.spyOn>;
    const suffix = Date.now();

    beforeEach(async () => {
        ({ sendEmail } = spyOnGoogleMail());
        await truncateMysql();
        await dropMongo();

        const userRepo = new UserRepository();
        userId = await userRepo.create({
            email: `commercial-ab-relance-${suffix}@test.local`,
            first_name: 'Commercial',
            last_name: String(suffix),
            password: 'hashed',
            role_id: 1,
            permission_id: 1,
            sectors: null,
            oauth_token: 'oauth-tok',
            refresh_token: 'refresh-tok',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function seedAb(
        id: string,
        opts: { sentDaysAgo: number; status?: NeedsAnalysisStatus; lastRelanceAt?: Date | null; signUrl?: string | null },
    ): Promise<void> {
        const repo = new NeedsAnalysisRepository();
        await repo.create({
            _id: id,
            company_infos: { name: `Entreprise ${suffix}` },
            saler_info: { id: userId },
            referents: { recruitment_referents: { name: 'Responsable', email: `signataire-${id}@test.local` } },
            positions: [{ title: 'Développeur' }],
            status: opts.status ?? NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            signature_request_id: `sub-${id}`,
            signature_sent_at: new Date(Date.now() - opts.sentDaysAgo * 24 * 60 * 60 * 1000),
            signature_url: opts.signUrl ?? `https://docuseal.test/s/${id}`,
            last_relance_at: opts.lastRelanceAt ?? null,
        });
    }

    it('envoie la relance pour une AB non signée depuis au moins 2 semaines', async () => {
        await seedAb(`ab-due-${suffix}`, { sentDaysAgo: 15 });

        const count = await new AbSignatureRelanceService().run();
        expect(count).toBe(1);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        const [, options] = sendEmail.mock.calls[0] as unknown as [any, { to: string; subject: string; html: string }];
        expect(options.to).toBe(`signataire-ab-due-${suffix}@test.local`);
        expect(options.subject).toContain('Rappel');
        expect(options.html).toContain(`https://docuseal.test/s/ab-due-${suffix}`);
        expect(options.html).toContain('Entreprise');
    });

    it('relance une seule fois (dédup via last_relance_at)', async () => {
        await seedAb(`ab-once-${suffix}`, { sentDaysAgo: 15 });

        const service = new AbSignatureRelanceService();
        expect(await service.run()).toBe(1);
        expect(await service.run()).toBe(0);
        expect(sendEmail).toHaveBeenCalledTimes(1);

        const ab = await new NeedsAnalysisRepository().findById(`ab-once-${suffix}`);
        expect(ab?.last_relance_at).toBeInstanceOf(Date);
    });

    it('ignore une AB envoyée depuis moins de 2 semaines', async () => {
        await seedAb(`ab-recent-${suffix}`, { sentDaysAgo: 13 });

        expect(await new AbSignatureRelanceService().run()).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('ignore une AB déjà signée', async () => {
        await seedAb(`ab-signed-${suffix}`, { sentDaysAgo: 30, status: NeedsAnalysisStatus.SIGNE });

        expect(await new AbSignatureRelanceService().run()).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('ne relance pas avant la barre des 2 semaines (paramètre now)', async () => {
        await seedAb(`ab-boundary-${suffix}`, { sentDaysAgo: 15 });

        // Si « maintenant » est simulé 14 jours plus tôt, l'envoi (15 jours avant
        // le now réel) n'a pas encore atteint les 2 semaines requises.
        const past = new Date(Date.now() - TWO_WEEKS_MS);
        expect(await new AbSignatureRelanceService().run(past)).toBe(0);
        expect(sendEmail).not.toHaveBeenCalled();
    });
});
