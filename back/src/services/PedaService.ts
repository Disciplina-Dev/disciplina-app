import { PedaConfigRepository } from '../repositories/mysql/PedaConfigRepository';
import { AppSettingsRepository } from '../repositories/mysql/AppSettingsRepository';

export class InvalidSheetLinkError extends Error {}
export class InvalidHourError extends Error {}

/** Clé app_settings : heure globale (HH:mm, heure Réunion) du job quotidien de brouillons. */
export const PEDA_DRAFT_HOUR_KEY = 'peda_draft_hour';
/** Clé app_settings : date (YYYY-MM-DD Réunion) de la dernière exécution du job. */
export const PEDA_DRAFT_LAST_RUN_KEY = 'peda_draft_last_run';

export const DEFAULT_DRAFT_HOUR = '08:00';

/** Accepte une URL Google Sheets complète ou un ID brut ; renvoie l'ID. */
export function parseSheetId(input: string): string {
    const trimmed = input.trim();
    const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (fromUrl) return fromUrl[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
    throw new InvalidSheetLinkError('Lien ou ID de Google Sheet invalide');
}

export class PedaService {
    private configRepo = new PedaConfigRepository();
    private settingsRepo = new AppSettingsRepository();

    async getConfig(userId: number): Promise<{ sheetId: string | null }> {
        const row = await this.configRepo.findByUserId(userId);
        return { sheetId: row?.sheet_id ?? null };
    }

    async setSheet(userId: number, link: string): Promise<{ sheetId: string }> {
        const sheetId = parseSheetId(link);
        await this.configRepo.upsert(userId, sheetId);
        return { sheetId };
    }

    async removeSheet(userId: number): Promise<void> {
        await this.configRepo.remove(userId);
    }

    async getDraftHour(): Promise<string> {
        return (await this.settingsRepo.get(PEDA_DRAFT_HOUR_KEY)) ?? DEFAULT_DRAFT_HOUR;
    }

    async setDraftHour(hour: string): Promise<void> {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)) throw new InvalidHourError('Heure invalide (format HH:mm)');
        await this.settingsRepo.set(PEDA_DRAFT_HOUR_KEY, hour);
    }
}
