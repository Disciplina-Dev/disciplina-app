import { env } from '../../config/env';
import { FilizToken } from './type';
import { logger } from '../logger';
import { FilizRepository } from '../../repositories/mysql/FilizRepository';

const AUTH_TIMEOUT_MS = 10_000;

export class FilizAuthClient {
    private AUTH_ENDPOINT = `${env.FILIZ_AUTH_URI}/oauth/token`;
    private AUTH_PARAMS = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.FILIZ_CLIENT_ID,
        client_secret: env.FILIZ_CLIENT_SECRET,
        audience: env.FILIZ_AUDIENCE,
    });
    private filizRepository = new FilizRepository();
    // Single-flight : des requêtes concurrentes sans token valide partagent un seul appel d'auth.
    private pending: Promise<string | null> | null = null;

    private isValidToken(token: Partial<FilizToken> | null): token is FilizToken {
        return (
            !!token &&
            typeof token.access_token === 'string' &&
            token.access_token !== '' &&
            typeof token.expires_in === 'number' &&
            Number.isFinite(token.expires_in) &&
            token.expires_in > 0
        );
    }

    private async generateToken(): Promise<string | null> {
        try {
            const response = await fetch(this.AUTH_ENDPOINT, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                },
                body: this.AUTH_PARAMS,
                signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
            });
            const text = await response.text();
            if (!response.ok) {
                logger.error({ status: response.status, body: text.slice(0, 500) }, 'FilizAuthClient: auth rejected');
                return null;
            }

            const token = JSON.parse(text) as Partial<FilizToken>;
            if (!this.isValidToken(token)) {
                logger.error('FilizAuthClient: auth response has no usable access_token/expires_in');
                return null;
            }
            // Un échec de persistance ne doit pas empêcher d'utiliser le token fraîchement obtenu.
            await this.filizRepository.deleteTokens();
            await this.filizRepository.insertToken(token);
            return token.access_token;
        } catch (error) {
            logger.error({ err: error }, 'FilizAuthClient: generateToken failed');
            return null;
        }
    }

    async getToken(): Promise<string | null> {
        const rows = await this.filizRepository.getToken();
        if (rows && rows.length > 0) return rows[0].token;

        this.pending ??= this.generateToken().finally(() => {
            this.pending = null;
        });
        return this.pending;
    }

    // Appelé quand Filiz répond 401 : le token en cache est révoqué avant son expiration.
    async invalidateToken(): Promise<void> {
        await this.filizRepository.deleteTokens(true);
    }
}
