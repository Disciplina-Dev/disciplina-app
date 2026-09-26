import { ExternalAccessRepository } from '../repositories/mysql/ExternalAccessRepository';
import { encodeExternalAccessCursor, ExternalAccessFilter, ExternalAccessListRow } from '../repositories/mysql/ExternalAccessRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { ExternalAccessRow } from '../types/db-rows.types';
import { Connection } from './pagination';
import { generateExternalSignature } from '../external/crypto';
import { renderTemplate } from './renderTemplate';
import { MailTemplateService } from './MailTemplateService';
import { CandidateService } from './CandidateService';
import { EXTERNAL_LINK_SUBJECT, EXTERNAL_LINK_BODY } from './externalLinkDefaultTemplate';
import { sendSystemEmail } from '../external/google/system-mail';
import { withNoReply } from '../external/google/no-reply';
import { logger } from '../external/logger';
import { env } from '../config/env';
import { signAccessToken } from '../rest/middleware/tokenAuth';
import { Permission, GuestRole } from '../types/user.types';
import { appendRegion } from '../db/tenant';

// Durée de vie d'un lien externe : 7 jours à compter de sa première ouverture
// (premier clic). Tant que le lien n'a jamais été ouvert, `expires_at` reste à
// null et le lien ne périme pas.
export const EXTERNAL_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type OpenLinkResult =
    | { status: 'NOT_FOUND'; httpCode: 404; message: string }
    | { status: 'COMPLETED'; httpCode: 200; message: string }
    | { status: 'BLOCKED'; httpCode: 200; message: string }
    | { status: 'EXPIRED'; httpCode: 410; message: string }
    | { status: 'OK'; httpCode: 200; message: string; token: string; referenceId: number; expiresAt: Date };

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
    | { success: false; error: string; referenceId?: number };

export class ExternalAccessService {
    constructor(
        private readonly repository = new ExternalAccessRepository(),
        private readonly candidateService = new CandidateService(),
        private readonly offerRepository = new OfferRepository(),
        private readonly mailTemplateService = new MailTemplateService(),
    ) {}

    async generate(input: GenerateInput): Promise<GenerateResult> {
        const signature = appendRegion(generateExternalSignature());

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

    /**
     * Crée une session externe sans envoyer de mail — le corps est composé et
     * envoyé par l'appelant (ex. modèle « Import CV » saisi par le RH). Lien
     * magique sans code : la première ouverture authentifie directement.
     */
    async createInvite(
        input: GenerateInput,
    ): Promise<{ success: true; signature: string; link: string } | { success: false; error: string }> {
        const signature = appendRegion(generateExternalSignature());

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
        return { success: true, signature, link };
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

    /**
     * Ouverture d'un lien magique (sans code) : la première ouverture arme
     * l'expiration à J+7, puis un cookie invité est émis. Idempotent : les
     * ouvertures suivantes réémettent un cookie tant que le lien n'a pas expiré.
     */
    async openLink(signature: string): Promise<OpenLinkResult> {
        const row = await this.repository.findBySignature(signature);

        if (!row) {
            return { status: 'NOT_FOUND', httpCode: 404, message: "KO signature doesn't exist" };
        }

        if (row.status === 'COMPLETED') {
            return { status: 'COMPLETED', httpCode: 200, message: 'KO signature already completed' };
        }

        if (row.status === 'LOCKED') {
            return { status: 'BLOCKED', httpCode: 200, message: 'KO signature locked' };
        }

        if (row.status === 'EXPIRED' || this.isExpired(row)) {
            if (row.status !== 'EXPIRED') {
                await this.repository.setStatus(signature, 'EXPIRED');
            }
            return { status: 'EXPIRED', httpCode: 410, message: 'KO signature expired' };
        }

        // Première ouverture : le lien devient valable 7 jours.
        let expiresAt = row.expires_at ? new Date(row.expires_at) : null;
        if (!expiresAt) {
            expiresAt = new Date(Date.now() + EXTERNAL_LINK_TTL_MS);
            await this.repository.setExpiresAt(signature, expiresAt);
        }

        const token = signAccessToken({
            role: GuestRole.EXTERNAL_GUEST,
            permission: Permission.GUEST,
            signature,
            referenceId: row.reference_id,
        });
        await this.repository.setToken(signature, token);
        if (row.status !== 'AUTHENTICATED') {
            await this.repository.setStatus(signature, 'AUTHENTICATED');
        }

        return { status: 'OK', httpCode: 200, message: 'OK signature opened', token, referenceId: row.reference_id, expiresAt };
    }

    isExpired(row: { expires_at: string | Date | null }): boolean {
        if (!row.expires_at) return false;
        return new Date(row.expires_at).getTime() < Date.now();
    }

    /**
     * Marque une session externe comme COMPLETED (ex. CV importé). Idempotent :
     * une session déjà COMPLETED reste acceptée sans erreur.
     */
    async complete(signature: string): Promise<GenerateResult> {
        const row = await this.repository.findBySignature(signature);

        if (!row) {
            return { success: false, error: 'KO signature does not exist' };
        }

        if (row.status !== 'COMPLETED') {
            await this.repository.setStatus(signature, 'COMPLETED');
        }

        return { success: true };
    }

    async list(filter: ExternalAccessFilter = {}): Promise<Connection<ExternalAccessListRow>> {
        const listRows = await this.repository.findAllFiltered(filter);
        const first = Math.max(1, Math.floor(Number(filter.first ?? 20)));
        const hasNextPage = listRows.length > first;
        const rows = hasNextPage ? listRows.slice(0, first) : listRows;

        const edges = rows.map((node) => ({
            node,
            cursor: encodeExternalAccessCursor(node.created_at ?? '', node.signature),
        }));

        return {
            edges,
            pageInfo: {
                hasNextPage,
                hasPreviousPage: !!filter.after,
                startCursor: edges[0]?.cursor ?? null,
                endCursor: edges[edges.length - 1]?.cursor ?? null,
            },
        };
    }

    async revoke(signature: string): Promise<{ success: boolean; error?: string }> {
        const row = await this.repository.findBySignature(signature);
        if (!row) {
            return { success: false, error: 'Signature introuvable' };
        }
        if (row.status === 'COMPLETED') {
            return { success: false, error: 'Les signatures complétées ne peuvent pas être révoquées' };
        }
        await this.repository.setStatus(signature, 'LOCKED');
        return { success: true };
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
