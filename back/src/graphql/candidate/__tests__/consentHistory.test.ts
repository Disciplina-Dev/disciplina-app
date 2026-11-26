import { describe, it, expect, beforeEach } from 'vitest';
import pool from '../../../db/mysql/connection';
import { env } from '../../../config/env';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { CandidateRepository } from '../../../repositories/mongo/CandidateRepository';
import { CandidateStatus } from '../../../types/candidate.types';

/**
 * GDPR_INF_08.2 — historique des consentements et retrait : chaque octroi /
 * retrait laisse une ligne horodatée côté serveur dans `candidate_consent_history`.
 */

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/candidates`;
const MCP_ENDPOINT = `http://localhost:${env.API_PORT}/api/mcp`;
const RH_USER_ID = 8_300_001;
const VERSION = '2026-11-v2';

const rhAuth = () =>
    mintAuthCookies({ id: RH_USER_ID, email: 'rh-consent@test.local', role: 'RH', permission: 'ADMIN' });

async function gql(query: string, variables: Record<string, unknown>, auth = rhAuth()) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

interface HistoryRow {
    consent_type: string;
    action: string;
    consent_version: string;
    source: string;
    recorded_by: number | null;
    recorded_at_epoch: string;
}

async function historyRows(candidateId: string): Promise<HistoryRow[]> {
    const [rows] = await pool.query<any[]>(
        `SELECT consent_type, action, consent_version, source, recorded_by, UNIX_TIMESTAMP(recorded_at) AS recorded_at_epoch
         FROM candidate_consent_history WHERE candidate_id = ? ORDER BY id`,
        [candidateId],
    );
    return rows as HistoryRow[];
}

const CREATE = `mutation($input: CreateCandidateInput!) { createCandidate(input: $input) { id } }`;
const UPDATE = `mutation($id: String!, $input: UpdateCandidateInput!) {
    updateCandidate(id: $id, input: $input) { id consentments { dataSharing aiProcessing consentDate consentVersion } }
}`;
const WITHDRAW = `mutation($id: String!, $types: [ConsentType!]!) {
    withdrawCandidateConsent(id: $id, types: $types) { id consentments { dataProcessing dataSharing aiProcessing photoProcessing consentVersion } }
}`;
const HISTORY = `query($id: String!) {
    candidateConsentHistory(candidateId: $id) { consentType action consentVersion source recordedByName recordedAt }
}`;

function consentInput(overrides: Record<string, unknown> = {}) {
    return {
        dataProcessing: true,
        dataSharing: true,
        aiProcessing: true,
        photoProcessing: false,
        // Date client volontairement fausse : le serveur doit l'ignorer.
        consentDate: '2001-01-01T00:00:00.000Z',
        consentVersion: VERSION,
        ...overrides,
    };
}

async function createCandidate(consentments = consentInput()): Promise<string> {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const json = await gql(CREATE, {
        input: {
            status: CandidateStatus.SEEKING,
            tpTypes: ['AD'],
            identity: { fullName: `Consent ${suffix}`, email: `consent-${suffix}@test.local`, phone: '0100000009' },
            consentments,
        },
    });
    expect(json.errors).toBeUndefined();
    return json.data.createCandidate.id;
}

async function mcpGetCandidate(id: string): Promise<unknown> {
    const res = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${env.MCP_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: 'get_candidate', arguments: { id } },
            id: 'consent-test',
        }),
    });
    const text = await res.text();
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    const parsed = JSON.parse(dataLine ? dataLine.slice('data:'.length).trim() : text);
    if (!parsed.result) throw new Error(`MCP error: ${text.slice(0, 300)}`);
    return JSON.parse(parsed.result.content[0].text);
}

describe('GDPR_INF_08.2 consent history', () => {
    beforeEach(async () => {
        await truncateMysql();
        await pool.execute(
            'INSERT INTO users (id, email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [RH_USER_ID, 'rh-consent@test.local', 'Rita', 'Haché', 'not-a-real-hash', 1, 1],
        );
    });

    describe('createCandidate', () => {
        it('records one GRANT per granted consent, server-timestamped, with the acting RH', async () => {
            const before = Date.now();
            const id = await createCandidate();

            const rows = await historyRows(id);
            expect(rows.map((r) => r.consent_type).sort()).toEqual([
                'ai_processing',
                'data_processing',
                'data_sharing',
            ]);
            for (const row of rows) {
                expect(row).toMatchObject({
                    action: 'GRANT',
                    consent_version: VERSION,
                    source: 'CREATE',
                    recorded_by: RH_USER_ID,
                });
                expect(Number(row.recorded_at_epoch) * 1000).toBeGreaterThanOrEqual(before - 1000);
            }

            // La date stockée sur la fiche est celle du serveur, pas celle envoyée (2001).
            const stored = await new CandidateRepository().findById(id);
            expect(new Date(stored!.consentments!.consent_date).getTime()).toBeGreaterThanOrEqual(before - 1000);
        });

        it('rejects an unknown consent version and writes nothing', async () => {
            const suffix = Date.now();
            const json = await gql(CREATE, {
                input: {
                    status: CandidateStatus.SEEKING,
                    tpTypes: ['AD'],
                    identity: { fullName: `Bad ${suffix}`, email: `bad-${suffix}@test.local`, phone: '0100000010' },
                    consentments: consentInput({ consentVersion: 'forged-v9' }),
                },
            });
            expect(json.errors?.[0]?.message).toContain('Version du texte de consentement inconnue');
            const [rows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM candidate_consent_history');
            expect(Number(rows[0].n)).toBe(0);
        });
    });

    describe('updateCandidate', () => {
        it('records nothing and keeps the original consent date when consents are unchanged', async () => {
            const id = await createCandidate();
            const original = await new CandidateRepository().findById(id);

            const json = await gql(UPDATE, { id, input: { consentments: consentInput() } });
            expect(json.errors).toBeUndefined();

            expect(await historyRows(id)).toHaveLength(3);
            const after = await new CandidateRepository().findById(id);
            expect(new Date(after!.consentments!.consent_date).getTime()).toBe(
                new Date(original!.consentments!.consent_date).getTime(),
            );
        });

        it('records only the consents that changed', async () => {
            const id = await createCandidate();

            const json = await gql(UPDATE, {
                id,
                input: { consentments: consentInput({ dataSharing: false, photoProcessing: true }) },
            });
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCandidate.consentments.dataSharing).toBe(false);

            const changes = (await historyRows(id)).filter((r) => r.source === 'UPDATE');
            expect(changes.map((r) => [r.consent_type, r.action]).sort()).toEqual([
                ['data_sharing', 'WITHDRAW'],
                ['photo_processing', 'GRANT'],
            ]);
        });

        it('records a re-consent (GRANT) when only the text version changes', async () => {
            const id = await createCandidate(consentInput({ consentVersion: '2026-08-v1' }));

            await gql(UPDATE, { id, input: { consentments: consentInput() } });

            const changes = (await historyRows(id)).filter((r) => r.source === 'UPDATE');
            expect(changes).toHaveLength(3);
            expect(changes.every((r) => r.action === 'GRANT' && r.consent_version === VERSION)).toBe(true);
        });
    });

    describe('withdrawCandidateConsent', () => {
        it('withdraws ai_processing, logs it, and removes the candidate from MCP tools', async () => {
            const id = await createCandidate();
            expect(await mcpGetCandidate(id)).not.toBeNull();

            const json = await gql(WITHDRAW, { id, types: ['AI_PROCESSING'] });
            expect(json.errors).toBeUndefined();
            expect(json.data.withdrawCandidateConsent.consentments).toEqual({
                dataProcessing: true,
                dataSharing: true,
                aiProcessing: false,
                photoProcessing: false,
                consentVersion: VERSION,
            });

            const withdrawals = (await historyRows(id)).filter((r) => r.source === 'WITHDRAWAL');
            expect(withdrawals).toEqual([
                expect.objectContaining({ consent_type: 'ai_processing', action: 'WITHDRAW', recorded_by: RH_USER_ID }),
            ]);
            expect(await mcpGetCandidate(id)).toBeNull();
        });

        it('is idempotent: withdrawing an already withdrawn consent records nothing new', async () => {
            const id = await createCandidate();
            await gql(WITHDRAW, { id, types: ['DATA_SHARING'] });
            await gql(WITHDRAW, { id, types: ['DATA_SHARING', 'PHOTO_PROCESSING'] });

            const withdrawals = (await historyRows(id)).filter((r) => r.source === 'WITHDRAWAL');
            expect(withdrawals).toHaveLength(1);
        });

        it('fails for an unknown candidate', async () => {
            const json = await gql(WITHDRAW, { id: 'does-not-exist', types: ['AI_PROCESSING'] });
            expect(json.errors?.[0]?.message).toContain('not found');
        });

        it('rejects a guest (below EMPLOYEE, not RH)', async () => {
            const id = await createCandidate();
            const guest = mintAuthCookies({
                id: RH_USER_ID,
                email: 'guest@test.local',
                role: 'COMMERCIAL',
                permission: 'GUEST',
            });

            const json = await gql(WITHDRAW, { id, types: ['AI_PROCESSING'] }, guest);
            expect(json.errors).toBeDefined();
            const stored = await new CandidateRepository().findById(id);
            expect(stored!.consentments!.ai_processing).toBe(true);
        });
    });

    describe('candidateConsentHistory', () => {
        it('returns events newest first with the author name', async () => {
            const id = await createCandidate();
            await gql(WITHDRAW, { id, types: ['DATA_SHARING'] });

            const json = await gql(HISTORY, { id });
            expect(json.errors).toBeUndefined();
            const events = json.data.candidateConsentHistory;
            expect(events).toHaveLength(4);
            expect(events[0]).toMatchObject({
                consentType: 'DATA_SHARING',
                action: 'WITHDRAW',
                source: 'WITHDRAWAL',
                consentVersion: VERSION,
                recordedByName: 'Rita Haché',
            });
            expect(Number.isNaN(Date.parse(events[0].recordedAt))).toBe(false);
        });

        it('rejects a guest (below EMPLOYEE, not RH)', async () => {
            const guest = mintAuthCookies({
                id: RH_USER_ID,
                email: 'guest@test.local',
                role: 'COMMERCIAL',
                permission: 'GUEST',
            });
            const json = await gql(HISTORY, { id: 'any' }, guest);
            expect(json.errors).toBeDefined();
            expect(json.data?.candidateConsentHistory ?? null).toBeNull();
        });
    });
});
