import { describe, it, expect, beforeEach } from 'vitest';
import pool from '../../../db/mysql/connection';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { CandidateService } from '../../../services/CandidateService';
import { CandidateStatus, TitleProfessionalType } from '../../../types/candidate.types';

/**
 * GDPR_INF_06.5 — journal d'accès : lecture d'une fiche, liste en masse et
 * démasquage du NIR laissent une ligne dans `candidate_access_log`.
 */

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/candidates`;
const RH_USER_ID = 8_360_001;
const PLAIN_SSN = '123456789012345';

const rhAuth = () =>
    mintAuthCookies({ id: RH_USER_ID, email: 'rh-access-log@test.local', role: 'RH', permission: 'ADMIN' });

async function gql(query: string, variables: Record<string, unknown> = {}, auth = rhAuth()) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

interface AccessRow {
    candidate_id: string | null;
    actor_id: number | null;
    actor_type: string;
    action: string;
    result_count: number;
}

async function accessRows(): Promise<AccessRow[]> {
    const [rows] = await pool.query<any[]>(
        'SELECT candidate_id, actor_id, actor_type, action, result_count FROM candidate_access_log ORDER BY id',
    );
    return rows as AccessRow[];
}

async function seedCandidate(suffix: string): Promise<string> {
    const id = `cand-access-${suffix}-${Date.now()}`;
    await new CandidateService().create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.AD],
        status: CandidateStatus.SEEKING,
        identity: {
            full_name: `Access ${suffix}`,
            email: `${id}@test.local`,
            phone: '0600000000',
            social_security_number: PLAIN_SSN,
        } as any,
    } as any);
    return id;
}

describe('candidate access log (GDPR_INF_06.5)', () => {
    beforeEach(async () => {
        await truncateMysql();
        await pool.query(
            'INSERT INTO users (id, email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [RH_USER_ID, 'rh-access-log@test.local', 'Rita', 'Log', 'not-a-real-hash', 1, 1],
        );
    });

    it('logs who opened a candidate sheet', async () => {
        const id = await seedCandidate('view');

        const json = await gql(`query($id: String!) { candidate(id: $id) { id } }`, { id });

        expect(json.errors).toBeUndefined();
        expect(await accessRows()).toEqual([
            { candidate_id: id, actor_id: RH_USER_ID, actor_type: 'STAFF', action: 'VIEW', result_count: 1 },
        ]);
    });

    it('logs a bulk list with the number of sheets returned', async () => {
        await seedCandidate('list-a');
        await seedCandidate('list-b');

        const json = await gql(`query { candidatesPage(first: 10) { edges { node { id } } } }`);

        expect(json.errors).toBeUndefined();
        const rows = await accessRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ candidate_id: null, action: 'LIST', actor_id: RH_USER_ID });
        expect(Number(rows[0].result_count)).toBe(json.data.candidatesPage.edges.length);
    });

    it('logs the SSN unmask, and not a failed one', async () => {
        const id = await seedCandidate('ssn');
        const noSsn = `cand-access-nossn-${Date.now()}`;
        await new CandidateService().create({
            _id: noSsn,
            candidate_id: noSsn,
            tp_types: [TitleProfessionalType.AD],
            status: CandidateStatus.SEEKING,
            identity: { full_name: 'No Ssn', email: `${noSsn}@test.local`, phone: '0600000001' } as any,
        } as any);

        const ok = await gql(`query($id: String!) { unmaskCandidateSsn(id: $id) }`, { id });
        const empty = await gql(`query($id: String!) { unmaskCandidateSsn(id: $id) }`, { id: noSsn });

        expect(ok.data.unmaskCandidateSsn).toBe(PLAIN_SSN);
        expect(empty.data.unmaskCandidateSsn).toBeNull();
        expect(await accessRows()).toEqual([
            { candidate_id: id, actor_id: RH_USER_ID, actor_type: 'STAFF', action: 'SSN_UNMASK', result_count: 1 },
        ]);
    });

    it('logs nothing for an unauthenticated request', async () => {
        const id = await seedCandidate('anon');

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query($id: String!) { unmaskCandidateSsn(id: $id) }`, variables: { id } }),
        });
        await res.json();

        expect(await accessRows()).toHaveLength(0);
    });
});
