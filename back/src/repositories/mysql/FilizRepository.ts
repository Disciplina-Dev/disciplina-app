import { query, getConnection } from '../../db/mysql/connection';
import { FilizToken } from '../../external/filiz/type';
import { logger } from '../../external/logger';
import { FilizRow } from '../../types/db-rows.types';

// Marge avant expiration : un token servi à 1 s de sa fin serait rejeté par Filiz en vol.
const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

export class FilizRepository {
    async getToken(): Promise<FilizRow[] | null> {
        return query<FilizRow[]>(
            'SELECT token FROM filiz WHERE expires_at > DATE_ADD(NOW(), INTERVAL ? SECOND) ORDER BY expires_at DESC LIMIT 1',
            [TOKEN_EXPIRY_MARGIN_SECONDS],
        );
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
            logger.error({ err: error }, 'FilizRepository: insertToken failed');
            return null;
        } finally {
            conn.release();
        }
    }

    // Purge les tokens expirés (ou, avec `all`, tous : token rejeté par Filiz avant son expiration).
    async deleteTokens(all = false): Promise<boolean> {
        const conn = await getConnection();
        try {
            const [result] = await conn.execute(
                all ? 'DELETE FROM filiz' : 'DELETE FROM filiz WHERE expires_at < NOW()',
            );
            return (result as { affectedRows: number }).affectedRows > 0;
        } catch (error) {
            logger.error({ err: error }, 'FilizRepository: deleteTokens failed');
            return false;
        } finally {
            conn.release();
        }
    }
}
