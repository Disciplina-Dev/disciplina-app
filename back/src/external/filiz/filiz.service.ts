import { FilizAuthClient } from './auth-client';
import { env } from '../../config/env';
import { logger } from '../logger';
import { Token } from 'graphql';

export class FilizService {
    private client = new FilizAuthClient();

    private async getDegreeIDs(): Promise<string[] | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const response = await fetch(`${env.FILIZ_BASE_URI}/api/degree`, {
                headers: {
                    authorization: `Bearer ${token}`,
                },
                method: 'GET',
                redirect: 'follow',
            });
            const json = await response.json();
            if (json?.error) return null;
            return json.degrees;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }

    async getDegreesInfos() {
        const token = await this.client.getToken();
        const degreesID = await this.getDegreeIDs();
        console.log(token);
        if (!token || !degreesID) return null;
        console.log(degreesID);
        try {
            const result = Promise.all(
                degreesID.map(async (id) => {
                    return (
                        await fetch(`${env.FILIZ_BASE_URI}/api/degree?degreeId=${id}`, {
                            headers: {
                                authorization: `Bearer ${token}`,
                            },
                            method: 'GET',
                            redirect: 'follow',
                        })
                    ).json();
                }),
            );
            return result;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }
}
