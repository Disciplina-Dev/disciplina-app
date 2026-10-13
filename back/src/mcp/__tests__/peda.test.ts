import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../config/env';
import pool from '../../db/mysql/connection';
import { truncateMysql } from '../../../test/helpers/db';
import { CandidateService } from '../../services/CandidateService';
import { AlternantService } from '../../services/AlternantService';
import { RuptureService } from '../../services/RuptureService';
import { NotificationService } from '../../services/NotificationService';
import { RUPTURE_MOTIFS } from '../../types/rupture.types';
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
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 'peda-test' }),
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

async function createAlternant(suffix: string, candidateId: string | null) {
    return new AlternantService().create({
        firstName: 'Léa',
        lastName: `Zorglub${suffix}`,
        session: `SESSION-${suffix}`,
        email: `lea-${suffix}@test.local`,
        phone: '0692111111',
        candidateId,
        company: {
            name: `Acme ${suffix}`,
            address: '12 rue des Palmiers, Saint-Denis',
            mentorName: 'Jean Dupont',
            startDate: '2026-09-01',
            endDate: '2027-06-30',
        },
    });
}

describe('MCP tools péda (static admin key)', () => {
    const run = Date.now().toString(36);
    beforeEach(async () => {
        await truncateMysql();
    });

    it('enregistre les outils péda', async () => {
        const parsed = await rpc('tools/list');
        const names: string[] = parsed.result.tools.map((t: { name: string }) => t.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'list_sessions',
                'get_session',
                'session_stats',
                'list_sequences_overdue',
                'list_sequences_upcoming',
                'list_alternant_sequences',
                'list_alternants',
                'get_alternant',
                'list_ruptures',
                'rupture_stats',
                'peda_kpi_overview',
                'peda_draft_stats',
            ]),
        );
    });

    it("n'expose qu'une identité minimisée pour un alternant consentant", async () => {
        const candidateId = `peda-ok-${run}`;
        await createCandidate(candidateId, true);
        const alternant = await createAlternant(`ok${run}`, candidateId);

        const list = await callTool('list_alternants', { search: `Zorglubok${run}` });
        expect(list.items).toHaveLength(1);
        expect(list.items[0]).toEqual({
            id: alternant._id,
            label: 'Léa Z.',
            session: `SESSION-ok${run}`,
            sessionId: null,
            archived: false,
            companyName: `Acme ok${run}`,
            contractStart: expect.any(String),
            contractEnd: expect.any(String),
        });
        const raw = JSON.stringify(list);
        for (const forbidden of ['Zorglub', '@test.local', '0692111111', 'Palmiers', 'Dupont', candidateId]) {
            expect(raw).not.toContain(forbidden);
        }

        const one = await callTool('get_alternant', { id: alternant._id });
        expect(one.label).toBe('Léa Z.');
        const sequences = await callTool<any[]>('list_alternant_sequences', { alternantId: alternant._id });
        expect(sequences.length).toBeGreaterThan(0);
    });

    it('masque les alternants sans candidat lié ou sans consentement ai_processing', async () => {
        const refusedId = `peda-no-${run}`;
        await createCandidate(refusedId, false);
        const refused = await createAlternant(`no${run}`, refusedId);
        const orphan = await createAlternant(`orphan${run}`, null);

        for (const alternant of [refused, orphan]) {
            expect(await callTool('get_alternant', { id: alternant._id })).toBeNull();
            expect(await callTool('list_alternant_sequences', { alternantId: alternant._id })).toBeNull();
        }
        const list = await callTool('list_alternants', { search: `Zorglub`, includeArchived: true });
        const ids = list.items.map((i: { id: string }) => i.id);
        expect(ids).not.toContain(refused._id);
        expect(ids).not.toContain(orphan._id);
    });

    it('refuse une recherche trop courte', async () => {
        const parsed = await rpc('tools/call', { name: 'list_alternants', arguments: { search: 'Zo' } });
        expect(parsed.result.isError).toBe(true);
    });

    it('list_ruptures ne renvoie ni détail ni entreprise et fond les motifs sensibles', async () => {
        const candidateId = `peda-rup-${run}`;
        await createCandidate(candidateId, true);
        const alternant = await createAlternant(`rup${run}`, candidateId);
        const refusedId = `peda-rup-no-${run}`;
        await createCandidate(refusedId, false);
        const hidden = await createAlternant(`rupno${run}`, refusedId);

        const declare = (alternantId: string) =>
            new RuptureService().declare({
                alternantId,
                dateRupture: '2026-11-10',
                entreprise: 'Acme',
                motif: RUPTURE_MOTIFS[5],
                detail: 'burn-out diagnostiqué',
                poursuitFormation: true,
            });
        await declare(alternant._id);
        await declare(hidden._id);

        const page = await callTool('list_ruptures', { year: 2026, month: 11 });
        const mine = page.items.filter((i: { alternantId: string }) => i.alternantId === alternant._id);
        expect(mine).toHaveLength(1);
        expect(mine[0].category).toBe('autre');
        expect(page.items.map((i: { alternantId: string }) => i.alternantId)).not.toContain(hidden._id);
        const raw = JSON.stringify(page);
        expect(raw).not.toContain('burn-out');
        expect(raw).not.toContain('Acme');
        expect(raw).not.toContain('motif');
    });

    it('masque les effectifs inférieurs à 5 dans les agrégats', async () => {
        const candidateId = `peda-stat-${run}`;
        await createCandidate(candidateId, true);
        await createAlternant(`stat${run}`, candidateId);

        const kpi = await callTool('peda_kpi_overview', { year: 2026 });
        expect(kpi.alternantsSnapshot.active === '<5' || kpi.alternantsSnapshot.active >= 5).toBe(true);
        expect(kpi.alternants).toBeUndefined();
        const ruptures = await callTool('rupture_stats', { year: 2030 });
        expect(ruptures.total).toBe(0);
    });

    it('journalise la consultation nominative sans PII (alternantId)', async () => {
        const candidateId = `peda-audit-${run}`;
        await createCandidate(candidateId, true);
        const alternant = await createAlternant(`audit${run}`, candidateId);
        await callTool('get_alternant', { id: alternant._id });
        await callTool('list_alternant_sequences', { alternantId: alternant._id });

        const [rows] = (await pool.query('SELECT tool, subject_ref FROM mcp_audit_log ORDER BY id')) as any;
        expect(rows.map((r: any) => r.subject_ref)).toEqual([`id:${alternant._id}`, `alternantId:${alternant._id}`]);
    });

    it('list_notifications masque le texte des notifications péda et candidat', async () => {
        const notifications = new NotificationService();
        await notifications.create({
            userId: 1,
            type: 'rupture_declared',
            category: 'peda',
            title: 'Rupture : Léa Zorglub',
            message: 'Léa Zorglub chez Acme',
            link: '/peda/alternants/abc',
        });
        await notifications.create({ userId: 1, type: 'x', category: 'company', title: 'Entreprise Acme relancée' });

        const list = await callTool<any[]>('list_notifications', { userId: 1 });
        const peda = list.find((n) => n.category === 'peda');
        expect(peda.message).toBeUndefined();
        expect(peda.link).toBeUndefined();
        expect(JSON.stringify(peda)).not.toContain('Zorglub');
        expect(list.find((n) => n.category === 'company').title).toBe('Entreprise Acme relancée');
    });
});
