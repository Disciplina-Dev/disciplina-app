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

    async generateToken(): Promise<FilizToken | null> {
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

    async getToken(): Promise<string | null> {
        const res = await this.filizRepository.getToken();
        return res ? res[0].token : null;
    }
}
