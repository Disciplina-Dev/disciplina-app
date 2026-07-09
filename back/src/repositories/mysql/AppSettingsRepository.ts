import { query } from '../../db/mysql/connection';

/** Réglages applicatifs clé/valeur (table app_settings). */
export class AppSettingsRepository {
    async get(key: string): Promise<string | null> {
        const rows = await query<{ setting_value: string | null }[]>(
            'SELECT setting_value FROM app_settings WHERE setting_key = ?',
            [key],
        );
        return rows[0]?.setting_value ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        await query(
            `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [key, value],
        );
    }
}
