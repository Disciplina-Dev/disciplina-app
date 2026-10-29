import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../config/env';
import { truncateMysql } from '../../../test/helpers/db';
import { CandidateService } from '../../services/CandidateService';
import { AlternantService } from '../../services/AlternantService';
import { AlternantRepository } from '../../repositories/mongo/AlternantRepository';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';

const MCP_ENDPOINT = `http://localhost:${env.API_PORT}/api/mcp`;
const MCP_KEY = env.MCP_API_KEY ?? '';

async function rpc(method: string, params?: Record<string, unknown>) {
    const res = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${MCP_KEY}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 'filiz-test' }),
    });
    const text = await res.text();
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    return JSON.parse(dataLine ? dataLine.slice('data:'.length).trim() : text);
}

async function callTool<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const parsed = await rpc('tools/call', { name, arguments: args });
    expect(parsed.result?.isError).toBeUndefined();
    return JSON.parse(parsed.result.content[0].text);
}

async function createCandidate(id: string, aiProcessing: boolean) {
    await new CandidateService().create({
        _id: id,
        candidate_id: id,
        tp_types: [TitleProfessionalType.CC],
        status: CandidateStatus.SEEKING,
        identity: { full_name: id, email: `${id}@test.local`, phone: '0692000004' } as any,
        consentments: {
            data_processing: true,
            data_sharing: true,
            ai_processing: aiProcessing,
            photo_processing: false,
            consent_date: new Date(),
            consent_version: '1',
        },
    } as any);
}

async function createFilizAlternant(suffix: string, candidateId: string | null, classId: string) {
    const created = await new AlternantService().create({
        firstName: 'Léa',
        lastName: `Zorglub${suffix}`,
        session: `SESSION-${suffix}`,
        email: `lea-${suffix}@test.local`,
        phone: '0692111111',
        candidateId,
        company: { name: `Acme ${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30' },
    });
    await new AlternantRepository().setFiliz(created._id, {
        folder_id: `folder-secret-${suffix}`,
        class_id: classId,
        degree_id: `degree-${suffix}`,
        student_id: `student-secret-${suffix}`,
        step: 2,
        start_step: 2,
        company_siret: '12345678901234',
        updated_at: new Date(),
        synced_at: new Date(),
    });
    return created;
}

describe('MCP tools Filiz (static admin key)', () => {
    const run = Date.now().toString(36);
    beforeEach(async () => {
        await truncateMysql();
    });

    it('enregistre les outils Filiz', async () => {
        const parsed = await rpc('tools/list');
        const names: string[] = parsed.result.tools.map((t: { name: string }) => t.name);
        expect(names).toEqual(
            expect.arrayContaining(['get_alternant_filiz', 'list_filiz_alternants', 'filiz_folder_stats']),
        );
    });

    it("n'expose ni identifiant Filiz ni donnée de contact", async () => {
        const candidateId = `filiz-ok-${run}`;
        const classId = `class-${run}`;
        await createCandidate(candidateId, true);
        const alternant = await createFilizAlternant(`ok${run}`, candidateId, classId);

        const expected = {
            id: alternant._id,
            label: 'Léa Z.',
            session: `SESSION-ok${run}`,
            sessionId: null,
            classId,
            step: 2,
            startStep: 2,
            inProgress: true,
            filizUpdatedAt: expect.any(String),
            syncedAt: expect.any(String),
        };
        const one = await callTool('get_alternant_filiz', { alternantId: alternant._id });
        expect(one).toEqual(expected);
        const list = await callTool('list_filiz_alternants', { sessionId: classId });
        expect(list.items).toEqual([expected]);

        const raw = JSON.stringify([one, list]);
        for (const forbidden of [
            'Zorglub',
            '@test.local',
            '0692111111',
            'folder-secret',
            'student-secret',
            '12345678901234',
            candidateId,
        ]) {
            expect(raw).not.toContain(forbidden);
        }
    });

    it('masque les alternants sans consentement ai_processing ou sans candidat lié', async () => {
        const refusedId = `filiz-no-${run}`;
        const classId = `class-hidden-${run}`;
        await createCandidate(refusedId, false);
        const refused = await createFilizAlternant(`no${run}`, refusedId, classId);
        await createFilizAlternant(`orphan${run}`, null, classId);

        expect(await callTool('get_alternant_filiz', { alternantId: refused._id })).toBeNull();
        expect((await callTool('list_filiz_alternants', { sessionId: classId })).items).toEqual([]);
        const stats = await callTool('filiz_folder_stats', { sessionId: classId });
        expect(stats.folders).toBe(0);
    });

    it('masque les effectifs inférieurs à 5 dans les stats', async () => {
        const candidateId = `filiz-stat-${run}`;
        const classId = `class-stat-${run}`;
        await createCandidate(candidateId, true);
        await createFilizAlternant(`stat${run}`, candidateId, classId);

        const stats = await callTool('filiz_folder_stats', { sessionId: classId });
        expect(stats).toEqual({ sessionId: classId, folders: '<5', inProgress: '<5', other: 'masqué' });
    });
});
