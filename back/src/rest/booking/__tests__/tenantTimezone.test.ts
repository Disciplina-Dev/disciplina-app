import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env';
import { getPool } from '../../../db/mysql/connection';
import { syncWithRegion } from '../../../db/tenant';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import type { Region } from '../../../types/tenant';

const BASE = `http://localhost:${env.API_PORT}/api/booking/settings`;
const suffix = Date.now();

const SEEDED: { region: Region; userId: number }[] = [];

async function seedRh(region: Region): Promise<number> {
    return syncWithRegion(region, async () => {
        const userId = await new UserRepository().create({
            email: `booking-tz-${region}-${suffix}@test.local`,
            first_name: 'RH',
            last_name: `Fuseau ${region}`,
            password: await bcrypt.hash('Password123456', 10),
            role_id: 2,
            permission_id: 1,
            sectors: null,
            oauth_token: null,
            refresh_token: null,
        });
        SEEDED.push({ region, userId });
        return userId;
    });
}

function settingsFor(region: Region, userId: number) {
    const { cookieHeader, csrfHeader } = mintAuthCookies({
        id: userId,
        email: `booking-tz-${region}-${suffix}@test.local`,
        role: 'RH',
        permission: 'EMPLOYEE',
        region,
    });
    return fetch(BASE, { headers: { Cookie: cookieHeader, 'x-csrf-token': csrfHeader } });
}

beforeEach(async () => {
    await truncateMysql();
});

afterAll(async () => {
    // booking_settings n'est pas dans CLEARED_TABLES (test/helpers/db.ts) et
    // truncateMysql() ne vide que la base réunion : on nettoie les deux régions.
    //
    // FOREIGN_KEY_CHECKS est désactivé le temps du delete : `truncateMysql()` ne
    // touche pas la base annemasse, donc un `external_access` laissé par un autre
    // fichier de test peut référencer l'id que notre utilisateur vient de
    // récupérer, et le DELETE FROM users échouerait en ER_ROW_IS_REFERENCED.
    await Promise.all(
        SEEDED.map(({ region, userId }) =>
            syncWithRegion(region, async () => {
                const conn = await getPool(region).getConnection();
                try {
                    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
                    await conn.execute('DELETE FROM booking_settings WHERE user_id = ?', [userId]);
                    await conn.execute('DELETE FROM users WHERE id = ?', [userId]);
                    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
                } finally {
                    conn.release();
                }
            }),
        ),
    );
});

describe('GET /api/booking/settings — fuseau par tenant', () => {
    // booking_settings.timezone n'est saisi dans aucune UI (PUT /settings accepte
    // bien un timezone, mais aucun écran ne l'expose) : toute valeur existante est
    // le DEFAULT de la colonne. C'est donc lui qu'on teste, via getOrCreate() — le
    // défaut Réunion laissé tel quel dans la CREATE TABLE de la base annemasse
    // produirait ici 'Indian/Reunion' et des créneaux décalés de 2 h.
    it('donne Europe/Paris sur annemasse et Indian/Reunion sur reunion', async () => {
        const annemasseId = await seedRh('annemasse');
        const reunionId = await seedRh('reunion');

        const [anne, reu] = await Promise.all([
            settingsFor('annemasse', annemasseId),
            settingsFor('reunion', reunionId),
        ]);

        expect(anne.status).toBe(200);
        expect(reu.status).toBe(200);

        // Littéraux, pas tenantTimezone() : la table doit être fausse ici pour que
        // le test échoue.
        const anneBody = await anne.json();
        const reuBody = await reu.json();
        expect(anneBody.settings.timezone).toBe('Europe/Paris');
        expect(reuBody.settings.timezone).toBe('Indian/Reunion');
    });
});
