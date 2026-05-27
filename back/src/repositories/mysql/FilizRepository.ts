import { query, getConnection } from '../../db/mysql/connection';
import { FilizToken } from '../../external/filiz/type';
import { logger } from '../../external/logger';
import { FilizRow } from '../../types/db-rows.types';

export class FilizRepository {
    async getToken(): Promise<FilizRow[] | null> {
        return query<FilizRow[]>('SELECT * FROM filiz WHERE expires_at < NOW()');
    }

    async insertToken(token: FilizToken): Promise<FilizToken | null> {
        const conn = await getConnection();

        try {
            const now = new Date();
            const expires_at = new Date(now.getTime() + token.expires_in * 1000);
            await conn.execute(`INSERT INTO filiz (token, created_at, expires_at) VALUES (?, ?, ?)`, [
                token.access_token,
                now,
                expires_at,
            ]);
            return token;
        } catch (error) {
            logger.error(error);
            return null;
        } finally {
            conn.release();
        }
    }

    async deleteTokens(): Promise<boolean> {
        const conn = await getConnection();
        try {
            const result = await conn.execute('DELETE FROM filiz');
            return (result[0] as any).affectedRows > 0;
        } catch (error) {
            logger.error(error);
            return false;
        } finally {
            conn.release();
        }
    }
}
