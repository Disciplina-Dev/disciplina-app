import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { ExternalAccessRow } from '../types/db-rows.types';
import { generateExternalSignature, generateNumericCode } from '../external/crypto';
import { renderTemplate } from './renderTemplate';
import { MailTemplateService } from './MailTemplateService';
import { CandidateService } from './CandidateService';
import { EXTERNAL_ACCESS_SUBJECT, EXTERNAL_ACCESS_BODY } from './externalAccessDefaultTemplate';
import { EXTERNAL_LINK_SUBJECT, EXTERNAL_LINK_BODY } from './externalLinkDefaultTemplate';
import { sendSystemEmail } from '../external/google/system-mail';
import { withNoReply } from '../external/google/no-reply';
import { logger } from '../external/logger';
import { env } from '../config/env';
import { MAX_ATTEMPTS } from './signedAccess';
import { signAccessToken } from '../rest/middleware/tokenAuth';
import { Permission, GuestRole } from '../types/user.types';

type SendCodeResult =
    | { status: 'NOT_FOUND'; httpCode: 404; message: string }
    | { status: 'COMPLETED'; httpCode: 200; message: string }
    | { status: 'BLOCKED'; httpCode: 200; message: string }
    | { status: 'OK'; httpCode: 200; message: string };

export interface GenerateInput {
    userId: number;
    externalId: string;
    externalType: 'COMPANY' | 'CANDIDATE';
    externalEmail: string;
    externalFirstName: string;
    referenceId: number;
    referenceKey: string;
}

export type GenerateResult =
    | { success: true; token?: string; referenceId?: number; referenceKey?: string }
    | { success: false; error: string };

export class ExternalAccessService {
    constructor(
        private readonly repository = new ExternalAccessRepository(),
        private readonly candidateService = new CandidateService(),
        private readonly offerRepository = new OfferRepository(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async generate(input: GenerateInput): Promise<GenerateResult> {
        const signature = generateExternalSignature();

        await this.repository.create({
            signature,
            code: null,
            token: null,
            user_id: input.userId,
            external_id: input.externalId,
            external_type: input.externalType,
            external_email: input.externalEmail,
            external_first_name: input.externalFirstName,
            reference_id: input.referenceId,
            reference_key: input.referenceKey,
            status: 'SENDING',
            attempts: 0,
            expires_at: null,
        });

        const link = `${env.FRONTEND_BASE_URL}/external/authenticate?sig=${signature}`;

        const template = await this.mailTemplateService.findRhTemplateByKind('external_link');
        const subject = template?.subject ?? EXTERNAL_LINK_SUBJECT;
        const body = template?.body ?? EXTERNAL_LINK_BODY;
        const html = renderTemplate(body, { prenom: input.externalFirstName, link });
        const text = html.replace(/<[^>]*>/g, '');

        try {
            await sendSystemEmail(withNoReply({ to: input.externalEmail, subject, html, text }));
        } catch (err) {
            logger.error({ err, signature }, '[external-access] failed to send link email');
        }

        return { success: true };
    }

    async regenerate(signature: string, userId: number): Promise<GenerateResult> {
        const row = await this.repository.findBySignature(signature);

        if (!row) {
            return { success: false, error: 'Signature introuvable' };
        }

        if (row.status !== 'EXPIRED' && row.status !== 'LOCKED') {
            return {
                success: false,
                error: 'Seules les signatures expirées ou bloquées peuvent être régénérées',
            };
        }

        const email = row.external_email ?? (await this.fallbackEmail(row));
        if (!email) {
            return { success: false, error: 'Aucun email associé à cette signature' };
        }

        const firstName = row.external_first_name ?? (await this.fallbackFirstName(row));

        const input: GenerateInput = {
            userId,
            externalId: row.external_id,
            externalType: row.external_type,
            externalEmail: email,
            externalFirstName: firstName,
            referenceId: row.reference_id,
            referenceKey: row.reference_key,
        };

        await this.repository.delete(signature);

        return this.generate(input);
    }

    async sendCode(signature: string): Promise<SendCodeResult> {
        const row = await this.repository.findBySignature(signature);

        if (!row) {
            return { status: 'NOT_FOUND', httpCode: 404, message: "KO signature doesn't exist" };
        }

        if (row.status === 'COMPLETED') {
            return { status: 'COMPLETED', httpCode: 200, message: 'KO signature already completed' };
        }

        if (row.status === 'EXPIRED' || row.status === 'LOCKED') {
            return { status: 'BLOCKED', httpCode: 200, message: 'KO signature expired or locked' };
        }

        const email = row.external_email ?? (await this.fallbackEmail(row));
        if (!email) {
            logger.warn({ signature, referenceId: row.reference_id }, '[external-access] could not resolve recipient email');
            return { status: 'OK', httpCode: 200, message: 'OK signature exists' };
        }

        const code = generateNumericCode(6);
        const firstName = row.external_first_name ?? (await this.fallbackFirstName(row));

        const template = await this.mailTemplateService.findRhTemplateByKind('external_access');
        const subject = template?.subject ?? EXTERNAL_ACCESS_SUBJECT;
        const body = template?.body ?? EXTERNAL_ACCESS_BODY;
        const html = renderTemplate(body, { prenom: firstName, code });
        const text = html.replace(/<[^>]*>/g, '');

        await sendSystemEmail(withNoReply({ to: email, subject, html, text }));

        await this.repository.setStatus(signature, 'PENDING');

        return { status: 'OK', httpCode: 200, message: 'OK signature exists' };
    }

    async inspect(signature: string, code: string): Promise<GenerateResult> {
        const row = await this.repository.findBySignature(signature);

        if (!row) {
            return { success: false, error: "KO signature doesn't exist" };
        }

        if (row.status === 'LOCKED') {
            return { success: false, error: 'KO Max attemps external link locked' };
        }

        if (row.status === 'AUTHENTICATED') {
            return { success: false, error: 'KO signature already authenticated' };
        }

        if (row.code === code) {
            const token = signAccessToken({
                role: GuestRole.EXTERNAL_GUEST,
                permission: Permission.GUEST,
                signature,
                referenceId: row.reference_id,
            });
            await this.repository.setToken(signature, token);
            await this.repository.setStatus(signature, 'AUTHENTICATED');
            return { success: true, token, referenceId: row.reference_id, referenceKey: row.reference_key };
        }

        const attempts = await this.repository.incrementAttempts(signature);

        if (attempts >= MAX_ATTEMPTS) {
            await this.repository.setStatus(signature, 'LOCKED');
            return { success: false, error: 'KO Max attemps external link locked' };
        }

        return { success: false, error: `KO Wrong code ${attempts} attempts` };
    }

    private async fallbackEmail(row: ExternalAccessRow): Promise<string | null> {
        try {
            if (row.reference_id === 1 || row.reference_id === 3) {
                const candidate = await this.candidateService.findById(row.reference_key);
                return candidate?.identity?.email ?? null;
            }
            if (row.reference_id === 2) {
                const offer = await this.offerRepository.findById(row.reference_key);
                return offer?.referents?.recruitment_referents?.email ?? null;
            }
        } catch (err) {
            logger.error({ err, signature: row.signature }, '[external-access] fallback email resolution failed');
        }
        return null;
    }

    private async fallbackFirstName(row: ExternalAccessRow): Promise<string> {
        try {
            if (row.reference_id === 1 || row.reference_id === 3) {
                const candidate = await this.candidateService.findById(row.reference_key);
                const fullName = candidate?.identity?.full_name ?? '';
                return fullName.split(' ')[0] || 'Client';
            }
            if (row.reference_id === 2) {
                const offer = await this.offerRepository.findById(row.reference_key);
                const name = offer?.referents?.recruitment_referents?.name ?? '';
                return name.split(' ')[0] || 'Client';
            }
        } catch {
            // fall through
        }
        return 'Client';
    }
}
