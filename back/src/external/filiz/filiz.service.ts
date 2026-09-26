import { FilizAuthClient } from './auth-client';
import { env } from '../../config/env';
import { logger } from '../logger';
import { FilizClass, FilizCreateFolderPayload, FilizDegree } from './type';

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
            const json = (await response.json()) as { error?: string; degrees?: string[] };
            if (json?.error) return null;
            return json.degrees ?? null;
        } catch (error) {
            logger.error({ err: error }, 'FilizService: getDegreeIDs failed');
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
            logger.error({ err: error }, 'FilizService: getDegreesInfos failed');
            return null;
        }
    }

    async getClassInfos(degreeId: string): Promise<FilizClass[] | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const classes = (await (
                await fetch(`${env.FILIZ_BASE_URI}/api/class?degreeId=${degreeId}`, {
                    headers: {
                        authorization: `Bearer ${token}`,
                    },
                    method: 'GET',
                    redirect: 'follow',
                })
            ).json()) as FilizClass[];

            return classes;
        } catch (error) {
            logger.error({ err: error }, 'FilizService: getClassInfos failed');
            return null;
        }
    }

    async createDegree(payload: Record<string, unknown>): Promise<string | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const response = await fetch(`${env.FILIZ_BASE_URI}/api/degree`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const json = (await response.json()) as { error?: string; degreeId?: string };
            if (json?.error) return null;
            return json.degreeId ?? null;
        } catch (error) {
            logger.error({ err: error }, 'FilizService: createDegree failed');
            return null;
        }
    }

    async createClass(payload: Record<string, unknown>): Promise<string | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const response = await fetch(`${env.FILIZ_BASE_URI}/api/class`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const json = (await response.json()) as { error?: string; classId?: string };
            if (json?.error) return null;
            return json.classId ?? null;
        } catch (error) {
            logger.error({ err: error }, 'FilizService: createClass failed');
            return null;
        }
    }

    async createFolder(payload: FilizCreateFolderPayload): Promise<string | null> {
        const token = await this.client.getToken();

        if (!token) return null;
        try {
            const response = await fetch(`${env.FILIZ_BASE_URI}/api/folder`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const json = (await response.json()) as { error?: string; folderId?: string };
            if (json?.error) return null;
            return json.folderId ?? null;
        } catch (error) {
            logger.error({ err: error }, 'FilizService: createFolder failed');
            return null;
        }
    }
}
