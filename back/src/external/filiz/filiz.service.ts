import { FilizAuthClient } from './auth-client';
import { env } from '../../config/env';
import { logger } from '../logger';
import { Token } from 'graphql';
import { FilizClass, FilizDegree } from './type';

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

    async getDegreesInfos(): Promise<FilizDegree[] | null> {
        const token = await this.client.getToken();
        const degreesID = await this.getDegreeIDs();

        if (!token || !degreesID) return null;

        try {
            const results = Promise.all(
                degreesID.map(async (id) => {
                    return await fetch(`${env.FILIZ_BASE_URI}/api/degree?degreeId=${id}`, {
                        headers: {
                            authorization: `Bearer ${token}`,
                        },
                        method: 'GET',
                        redirect: 'follow',
                    }).then((response) => response.json() as unknown as FilizDegree);
                }),
            );

            return results;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }

    async getClassInfos(degreeId: string): Promise<FilizClass[] | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const classes = await (
                await fetch(`${env.FILIZ_BASE_URI}/api/class?degreeId=${degreeId}`, {
                    headers: {
                        authorization: `Bearer ${token}`,
                    },
                    method: 'GET',
                    redirect: 'follow',
                })
            ).json();

            console.log('classes: ', classes);
            const results = Promise.all(
                ((await classes) as any[]).map(async (c) => {
                    return fetch(`${env.FILIZ_BASE_URI}/api/class?classId=${c.classId}`, {
                        headers: {
                            authorization: `Bearer ${token}`,
                        },
                        method: 'GET',
                        redirect: 'follow',
                    }).then((response) => response.json() as unknown as FilizClass);
                }),
            );

            return results;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }
}
