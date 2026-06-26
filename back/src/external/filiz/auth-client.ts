import { env } from '../../config/env';
import { FilizToken } from './type';
import { logger } from '../logger';
import { FilizRepository } from '../../repositories/mysql/FilizRepository';

export class FilizAuthClient {
    private AUTH_ENDPOINT = `${env.FILIZ_AUTH_URI}/oauth/token`;
    private AUTH_PARAMS = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.FILIZ_CLIENT_ID,
        client_secret: env.FILIZ_CLIENT_SECRET,
        audience: env.FILIZ_AUDIENCE,
    });
    private filizRepository = new FilizRepository();

    private async generateToken(): Promise<FilizToken | null> {
        try {
            const response = await fetch(this.AUTH_ENDPOINT, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                },
                body: this.AUTH_PARAMS,
            });

            const token = JSON.parse(await response.text()) as FilizToken;
            const inserted = await this.filizRepository.insertToken(token);
            return inserted;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }

    private async deleteToken(): Promise<boolean> {
        return await this.filizRepository.deleteTokens();
    }

    async refreshToken(): Promise<string | null> {
        const tokens = await this.filizRepository.getToken();

        if (tokens?.length !== undefined && tokens.length > 0) return tokens[0].token;
        await this.deleteToken();
        if (tokens?.length !== undefined && !tokens.length) {
            const new_token = await this.generateToken();
            return new_token ? new_token.access_token : null;
        }
        return null;
    }

    async getToken(): Promise<string | null> {
        const res = await this.filizRepository.getToken();
        if (res?.length === 0) {
            const token = await this.generateToken();
            return token === null ? null : token.access_token;
        }
        return res ? res[0].token : await this.refreshToken();
    }
}
