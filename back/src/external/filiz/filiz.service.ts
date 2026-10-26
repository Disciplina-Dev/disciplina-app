import { FilizAuthClient } from './auth-client';
import { env } from '../../config/env';
import { logger } from '../logger';
import { FilizClass, FilizCreateFolderPayload, FilizDegree, FilizFolder, FilizUser } from './type';

const REQUEST_TIMEOUT_MS = 15_000;
const DEGREE_FETCH_CONCURRENCY = 5;
const FOLDER_FETCH_CONCURRENCY = 5;

export class FilizService {
    private client = new FilizAuthClient();

    // Appel authentifié : timeout, un seul retry avec token neuf sur 401, statut HTTP vérifié,
    // erreur Filiz journalisée. Renvoie le JSON, ou null en cas d'échec.
    private async request<T>(
        path: string,
        init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' },
    ): Promise<T | null> {
        for (let attempt = 0; attempt < 2; attempt++) {
            const token = await this.client.getToken();
            if (!token) return null;

            try {
                const response = await fetch(`${env.FILIZ_BASE_URI}${path}`, {
                    method: init.method,
                    headers: {
                        authorization: `Bearer ${token}`,
                        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
                    },
                    body: init.body === undefined ? undefined : JSON.stringify(init.body),
                    redirect: 'follow',
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });

                if (response.status === 401 && attempt === 0) {
                    await this.client.invalidateToken();
                    continue;
                }
                if (!response.ok) {
                    const body = (await response.text()).slice(0, 500);
                    logger.error({ status: response.status, path, body }, 'FilizService: request rejected');
                    return null;
                }
                return (await response.json()) as T;
            } catch (error) {
                logger.error({ err: error, path }, 'FilizService: request failed');
                return null;
            }
        }
        return null;
    }

    private async getDegreeIDs(): Promise<string[] | null> {
        const json = await this.request<{ error?: string; degrees?: string[] }>('/api/degree');
        if (!json || json.error) return null;
        return json.degrees ?? null;
    }

    async getDegreesInfos(): Promise<FilizDegree[] | null> {
        const degreeIds = await this.getDegreeIDs();
        if (!degreeIds) return null;

        // Concurrence bornée : un appel par degree, mais pas tous en même temps.
        const degrees: FilizDegree[] = [];
        let failed = 0;
        for (let i = 0; i < degreeIds.length; i += DEGREE_FETCH_CONCURRENCY) {
            const batch = degreeIds.slice(i, i + DEGREE_FETCH_CONCURRENCY);
            const results = await Promise.all(
                batch.map((id) =>
                    this.request<FilizDegree & { error?: string }>(`/api/degree?degreeId=${encodeURIComponent(id)}`),
                ),
            );
            for (const result of results) {
                if (result && !result.error) degrees.push(result);
                else failed++;
            }
        }
        if (failed > 0)
            logger.warn({ failed, total: degreeIds.length }, 'FilizService: some degrees could not be fetched');
        if (degreeIds.length > 0 && degrees.length === 0) return null;
        return degrees;
    }

    async getClassInfos(degreeId: string): Promise<FilizClass[] | null> {
        const classes = await this.request<FilizClass[]>(`/api/class?degreeId=${encodeURIComponent(degreeId)}`);
        return Array.isArray(classes) ? classes : null;
    }

    // Filiz ne renvoie ici que les ids : le détail se récupère folder par folder (getFolders).
    async listFolderIds(): Promise<string[] | null> {
        const json = await this.request<{ error?: string; folders?: string[] }>('/api/folder');
        if (!json || json.error) return null;
        return json.folders ?? null;
    }

    async getFolder(folderId: string): Promise<FilizFolder | null> {
        const json = await this.request<FilizFolder & { error?: string }>(
            `/api/folder?folderId=${encodeURIComponent(folderId)}`,
        );
        if (!json || json.error) return null;
        return json;
    }

    // Concurrence bornée, comme getDegreesInfos. Les folders en échec sont omis (comptés dans `failed`).
    async getFolders(folderIds: string[]): Promise<{ folders: FilizFolder[]; failed: number }> {
        const folders: FilizFolder[] = [];
        let failed = 0;
        for (let i = 0; i < folderIds.length; i += FOLDER_FETCH_CONCURRENCY) {
            const results = await Promise.all(
                folderIds.slice(i, i + FOLDER_FETCH_CONCURRENCY).map((id) => this.getFolder(id)),
            );
            for (const result of results) {
                if (result) folders.push(result);
                else failed++;
            }
        }
        return { folders, failed };
    }

    async getUser(userId: string): Promise<FilizUser | null> {
        const json = await this.request<FilizUser & { error?: string }>(
            `/api/user?userId=${encodeURIComponent(userId)}`,
        );
        if (!json || json.error) return null;
        return json;
    }

    async createDegree(payload: Record<string, unknown>): Promise<string | null> {
        const json = await this.request<{ error?: string; degreeId?: string }>('/api/degree', {
            method: 'POST',
            body: payload,
        });
        if (!json || json.error) return null;
        return json.degreeId ?? null;
    }

    async createClass(payload: Record<string, unknown>): Promise<string | null> {
        const json = await this.request<{ error?: string; classId?: string }>('/api/class', {
            method: 'POST',
            body: payload,
        });
        if (!json || json.error) return null;
        return json.classId ?? null;
    }

    async createFolder(payload: FilizCreateFolderPayload): Promise<string | null> {
        const json = await this.request<{ error?: string; folderId?: string }>('/api/folder', {
            method: 'POST',
            body: payload,
        });
        if (!json || json.error) return null;
        return json.folderId ?? null;
    }
}
