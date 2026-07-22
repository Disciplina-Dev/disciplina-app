import { ExternalLinkRepository } from '../repositories/mysql/ExternalLinkRepository';
import { ExternalLinkStatus, GuestType } from '../types/externalLink.types';
import { generateExternalSignature, generateNumericCode, timingSafeEqualString } from '../external/crypto';
import { issueExternalToken } from './externalToken';
import { MAX_ATTEMPTS, AuthResult, isSignedAccessExpired as isExpired } from './signedAccess';

export type { AuthResult };

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateExternalLinkInput {
    externalEmail: string;
    rhEmail: string;
    guestType: 'COMPANY' | 'CANDIDATE';
    externalUuid: string;
}

export interface ExternalLinkCredentials {
    signature: string;
    code: string;
}

export interface ExternalLinkContext {
    externalEmail: string;
    rhEmail: string;
    guestType: 'COMPANY' | 'CANDIDATE';
    externalUuid: string;
    status: ExternalLinkStatus;
}

export class ExternalLinkService {
    constructor(private readonly repository = new ExternalLinkRepository()) {}

    async createLink(input: CreateExternalLinkInput): Promise<ExternalLinkCredentials> {
        const signature = generateExternalSignature();
        const code = generateNumericCode(6);
        await this.repository.create({
            signature,
            code,
            external_email: input.externalEmail,
            rh_email: input.rhEmail,
            guest_type: input.guestType,
            external_uuid: input.externalUuid,
            expires_at: new Date(Date.now() + LINK_TTL_MS),
        });
        return { signature, code };
    }

    async inspect(
        signature: string,
    ): Promise<{ exists: boolean; expired: boolean; status: ExternalLinkStatus | null; guestType?: string }> {
        const row = await this.repository.findBySignature(signature);
        if (!row) return { exists: false, expired: false, status: null };
        return {
            exists: true,
            expired: isExpired(row),
            status: row.status as ExternalLinkStatus,
            guestType: row.guest_type,
        };
    }

    async authenticate(signature: string, code: string): Promise<AuthResult> {
        const row = await this.repository.findBySignature(signature);
        if (!row || row.status === ExternalLinkStatus.LOCKED) return { ok: false, reason: 'locked' };
        if (isExpired(row)) return { ok: false, reason: 'expired' };

        if (!timingSafeEqualString(code, row.code)) return this.registerFailedAttempt(signature);

        await this.repository.setStatus(signature, ExternalLinkStatus.AUTHENTICATED);
        const expiresIn = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
        return {
            ok: true,
            token: issueExternalToken(
                signature,
                row.guest_type as 'COMPANY' | 'CANDIDATE',
                row.external_uuid,
                expiresIn,
            ),
        };
    }

    async getContext(signature: string): Promise<ExternalLinkContext | null> {
        const row = await this.repository.findBySignature(signature);
        if (!row) return null;
        return {
            externalEmail: row.external_email,
            rhEmail: row.rh_email,
            guestType: row.guest_type as 'COMPANY' | 'CANDIDATE',
            externalUuid: row.external_uuid,
            status: row.status as ExternalLinkStatus,
        };
    }

    private async registerFailedAttempt(signature: string): Promise<AuthResult> {
        const attempts = await this.repository.incrementAttempts(signature);
        if (attempts >= MAX_ATTEMPTS) {
            await this.repository.setStatus(signature, ExternalLinkStatus.LOCKED);
            return { ok: false, reason: 'locked' };
        }
        return { ok: false, reason: 'invalid', remaining: MAX_ATTEMPTS - attempts };
    }
}
