import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { env } from '../../../config/env';
import { ExternalAccessRepository } from '../../../repositories/mysql/ExternalAccessRepository';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { CandidateHistoryRepository } from '../../../repositories/mongo/CandidateHistoryRepository';
import { seedOffer } from '../../../../test/helpers/seedOffer';
import { truncateMysql } from '../../../../test/helpers/db';
import { GoogleCalendarService } from '../../../external/google/calendar.service';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../../middleware/tokenAuth';
import { appendRegion, syncWithRegion } from '../../../db/tenant';
import { getModels } from '../../../db/mongo/tenant';
import { getPool } from '../../../db/mysql/connection';
import { GuestRole, Permission } from '../../../types/user.types';
import { OfferStatus, MatchedCandidateStatus, Sex } from '../../../types/matching.types';
import { CandidateHistoryType } from '../../../types/candidate.types';
import type { Region } from '../../../types/tenant';

const BASE = `http://localhost:${env.API_PORT}/api/external`;

const repository = new ExternalAccessRepository();
const userRepository = new UserRepository();

/** 09:00 UTC en janvier : 10:00 à Annemasse (CET, UTC+1), 13:00 à La Réunion
 *  (UTC+4). Les deux rendus diffèrent donc de 3 h — un test qui assertait
 *  l'égalité entre les deux ne prouverait rien. */
const SLOT = '2030-01-15T09:00:00.000Z';
const SLOT_HOUR_REUNION = '13:00';
const SLOT_HOUR_ANNEMASSE = '10:00';

const suffix = Date.now();
const SEEDED: { region: Region; offerId: string; candidateId: string; userId: number; sig: string }[] = [];

function signature(name: string, region: Region): string {
    return appendRegion(`${name}-${suffix}`.padEnd(64, '0'), region);
}

function guestCookie(sig: string, referenceId = 3): string {
    const token = signAccessToken({
        role: GuestRole.EXTERNAL_GUEST,
        permission: Permission.GUEST,
        signature: sig,
        referenceId,
    });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

async function seedSession(region: Region, name: string): Promise<{ sig: string; candidateId: string }> {
    return syncWithRegion(region, async () => {
        // Suffixe par appel : deux sessions du même tenant dans le même fichier
        // ne doivent pas se marcher dessus (users.email est UNIQUE).
        const uniq = `${suffix}-${SEEDED.length}`;
        const rhId = await userRepository.create({
            email: `rh-interview-tz-${region}-${uniq}@test.local`,
            first_name: 'RH',
            last_name: region,
            password: 'hashed',
            role_id: 2,
            permission_id: 1,
            sectors: null,
            oauth_token: null,
            refresh_token: null,
        });
        const candidateId = `cand-tz-${region}-${uniq}`;
        const offerId = `job-interview-tz-${region}-${uniq}`;
        await seedOffer({
            _id: offerId,
            company_name: `Interview TZ Corp ${region}`,
            status: OfferStatus.CV_SEND,
            interview_slots: [SLOT],
            interview_location: 'Saint-Denis, 12 rue des Tests',
            candidates: [
                {
                    id: candidateId,
                    full_name: `Candidate ${region}`,
                    email: `cand-tz-${region}-${suffix}@test.local`,
                    age: 30,
                    sex: Sex.NONE,
                    status: MatchedCandidateStatus.INTERVIEW,
                },
            ],
        });
        const sig = signature(name, region);
        await repository.create({
            signature: sig,
            code: null,
            user_id: rhId,
            external_id: offerId,
            external_type: 'CANDIDATE',
            external_email: candidateId,
            external_first_name: 'Candidate',
            reference_id: 3,
            reference_key: candidateId,
            status: 'AUTHENTICATED',
            attempts: 0,
            expires_at: null,
        });
        SEEDED.push({ region, offerId, candidateId, userId: rhId, sig });
        return { sig, candidateId };
    });
}

describe('Fuseau du tenant sur le parcours entretien externe (TZ-02)', () => {
    let freeBusySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        freeBusySpy = vi.spyOn(GoogleCalendarService.prototype, 'freeBusy').mockResolvedValue([]);
        await truncateMysql();
    });

    afterEach(() => {
        freeBusySpy.mockRestore();
    });

    afterAll(async () => {
        // truncateMysql() ne vide que la base réunion : les seeds annemasse
        // sont nettoyés explicitement pour ne rien laisser derrière.
        // FOREIGN_KEY_CHECKS est désactivé le temps du delete : un external_access
        // laissé par un autre fichier peut référencer l'id réutilisé, et le
        // DELETE FROM users échouerait en ER_ROW_IS_REFERENCED.
        await Promise.all(
            SEEDED.map(({ region, offerId, candidateId, userId, sig }) =>
                syncWithRegion(region, async () => {
                    await getModels().Offer.deleteMany({ _id: offerId });
                    await getModels().CandidateHistory.deleteMany({ candidate_id: candidateId });
                    await repository.delete(sig);
                    const conn = await getPool(region).getConnection();
                    try {
                        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
                        await conn.execute('DELETE FROM users WHERE id = ?', [userId]);
                        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
                    } finally {
                        conn.release();
                    }
                }),
            ),
        );
    });

    it('formate le créneau réservé dans le fuseau du tenant annemasse', async () => {
        const { sig, candidateId } = await seedSession('annemasse', 'sig-interview-tz-anne');

        const res = await fetch(`${BASE}/${sig}/interview/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
            body: JSON.stringify({ slot: SLOT }),
        });
        expect(res.status).toBe(200);

        // formatFr() d'ExternalInterviewService : l'ALS vient de la région
        // suffixée de la signature via resolveExternalRegion.
        const history = await syncWithRegion('annemasse', () =>
            new CandidateHistoryRepository().findByCandidateId(candidateId),
        );
        const entry = history.find((h) => h.type === CandidateHistoryType.CANDIDATE);
        const description = entry?.description ?? '';
        expect(description).toContain(SLOT_HOUR_ANNEMASSE);
        expect(description).not.toContain(SLOT_HOUR_REUNION);
    });

    it('formate le créneau réservé dans le fuseau du tenant reunion', async () => {
        const { sig, candidateId } = await seedSession('reunion', 'sig-interview-tz-reu');

        const res = await fetch(`${BASE}/${sig}/interview/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: guestCookie(sig) },
            body: JSON.stringify({ slot: SLOT }),
        });
        expect(res.status).toBe(200);

        const history = await new CandidateHistoryRepository().findByCandidateId(candidateId);
        const entry = history.find((h) => h.type === CandidateHistoryType.CANDIDATE);
        const description = entry?.description ?? '';
        expect(description).toContain(SLOT_HOUR_REUNION);
        expect(description).not.toContain(SLOT_HOUR_ANNEMASSE);
    });

    it('expose le fuseau du tenant sur GET /:signature/profile', async () => {
        // TZ-04/TZ-05 : le guest n'a pas de session staff, donc /api/auth/me est
        // indisponible. /profile est le carrier que les deux pages guest
        // consomment déjà.
        const anne = await seedSession('annemasse', 'sig-interview-tz-prof-anne');
        const anneRes = await fetch(`${BASE}/${anne.sig}/profile`, { headers: { Cookie: guestCookie(anne.sig) } });
        expect(anneRes.status).toBe(200);
        expect(((await anneRes.json()) as { timezone: string }).timezone).toBe('Europe/Paris');

        const reu = await seedSession('reunion', 'sig-interview-tz-prof-reu');
        const reuRes = await fetch(`${BASE}/${reu.sig}/profile`, { headers: { Cookie: guestCookie(reu.sig) } });
        expect(reuRes.status).toBe(200);
        expect(((await reuRes.json()) as { timezone: string }).timezone).toBe('Indian/Reunion');
    });
});
