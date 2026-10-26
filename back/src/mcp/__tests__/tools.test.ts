import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../config/env';
import pool from '../../db/mysql/connection';
import { truncateMysql } from '../../../test/helpers/db';
import { CandidateService } from '../../services/CandidateService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { OfferHistoryService } from '../../services/OfferHistoryService';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { DAILY_CALL_LIMIT } from '../limits';
import { encodeCursor } from '../../services/pagination';
import { CandidateStatus, TitleProfessionalType } from '../../types/candidate.types';

const MCP_ENDPOINT = `http://localhost:${env.API_PORT}/api/mcp`;
// Clé statique = contexte admin : accès à tous les outils.
const MCP_KEY = env.MCP_API_KEY ?? '';

async function rpc(method: string, params?: Record<string, unknown>) {
    const res = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${MCP_KEY}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 'tools-test' }),
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

describe('MCP tools (static admin key)', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('registers the audit-driven tools', async () => {
        const parsed = await rpc('tools/list');
        const names: string[] = parsed.result.tools.map((t: { name: string }) => t.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'list_users',
                'list_offer_history',
                'list_company_conflicts',
                'company_stats',
                'kpi_live',
                'kpi_monthly_detail',
                'kpi_weekly_detail',
            ]),
        );
        expect(names).toHaveLength(45);
    });

    it('masks the SSN and serializes dates as ISO strings on get_candidate', async () => {
        const id = `cand-mcp-${Date.now()}`;
        await new CandidateService().create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.CC],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: 'Candidat MCP',
                email: `${id}@test.local`,
                phone: '0692000003',
                social_security_number: '1850578006048',
            } as any,
            consentments: {
                data_processing: true,
                data_sharing: false,
                ai_processing: true,
                photo_processing: false,
                consent_date: new Date('2026-01-02T03:04:05.000Z'),
                consent_version: '1',
            },
        } as any);

        const candidate = await callTool('get_candidate', { id });
        expect(candidate.identity.social_security_number).toBe('[chiffré]');
        expect(candidate.consentments.consent_date).toBe('2026-01-02T03:04:05.000Z');

        const list = await callTool<any[]>('search_candidates', { search: 'Candidat MCP' });
        expect(list.every((c) => c.identity?.social_security_number !== '1850578006048')).toBe(true);
        expect(JSON.stringify(list)).not.toContain('"iv"');
    });

    it('applies first/after when search is set on search_companies', async () => {
        const repo = new CompanyRepository();
        const ids: number[] = [];
        for (const letter of ['A', 'B', 'C']) {
            ids.push(
                await repo.create({
                    name: `Pagi Corp ${letter}`,
                    siret: `1234567890123${ids.length}`,
                    address: 'Rue Test',
                    sector: 'IT',
                }),
            );
        }

        const page1 = await callTool<{ id: number }[]>('search_companies', { search: 'pagi corp', first: 1 });
        expect(page1.map((c) => c.id)).toEqual([ids[0], ids[1]]); // first + 1 (lookahead)

        const page2 = await callTool<{ id: number }[]>('search_companies', {
            search: 'pagi corp',
            first: 1,
            after: encodeCursor(String(ids[0])),
        });
        expect(page2.map((c) => c.id)).toEqual([ids[1], ids[2]]);
    });

    it('searches the blacklist case-insensitively and returns camelCase keys', async () => {
        const repo = new CompanyRepository();
        const companyId = await repo.create({
            name: 'Ban Corp Casse',
            siret: '98765432109876',
            address: 'Rue Test',
            sector: 'IT',
        });
        await new CompaniesBlacklistService().blacklistCompany(companyId, 'Fraude', false);

        const rows = await callTool<any[]>('list_blacklist', { search: 'ban corp CASSE' });
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Ban Corp Casse');
        expect(rows[0]).not.toHaveProperty('all_blacklist');
    });

    it('list_users returns the directory without email nor credentials', async () => {
        await pool.execute(
            'INSERT INTO users (id, email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [8_100_001, 'dir@test.local', 'Dir', 'Ectory', 'not-a-real-hash', 1, 1],
        );
        const users = await callTool<any[]>('list_users');
        const entry = users.find((u) => u.id === 8_100_001);
        expect(entry).toMatchObject({ firstName: 'Dir', lastName: 'Ectory' });
        expect(entry).not.toHaveProperty('email');
        expect(JSON.stringify(users)).not.toContain('not-a-real-hash');
    });

    it('list_offer_history returns entries newest first with ISO dates', async () => {
        const history = new OfferHistoryService();
        const offerId = `offer-hist-${Date.now()}`;
        await history.recordAuto(offerId, 'Offre créée');
        await history.recordManual(offerId, 'Jean', 'Dupont', 'Relance faite', 'jean@test.local');

        const entries = await callTool<any[]>('list_offer_history', { offerId });
        expect(entries).toHaveLength(2);
        expect(entries[0].text).toBe('Relance faite');
        expect(typeof entries[0].createdAt).toBe('string');
        expect(entries[0]).not.toHaveProperty('firstName');
        expect(entries[0]).not.toHaveProperty('lastName');
        expect(entries[0]).not.toHaveProperty('ownerEmail');
    });

    it('list_company_conflicts is callable by an admin', async () => {
        const conflicts = await callTool<unknown[]>('list_company_conflicts', {});
        expect(Array.isArray(conflicts)).toBe(true);
    });

    it('exposes company stats and KPI live/monthly/weekly views', async () => {
        const year = new Date().getFullYear();
        const stats = await callTool('company_stats', { year });
        expect(Array.isArray(stats.current)).toBe(true);
        expect(Array.isArray(stats.years)).toBe(true);

        const live = await callTool('kpi_live');
        expect(live).toHaveProperty('totals');
        expect(Array.isArray(live.sites)).toBe(true);

        const monthly = await callTool('kpi_monthly_detail', { year, site: 'NORD' });
        expect(Array.isArray(monthly.months)).toBe(true);
        const weekly = await callTool('kpi_weekly_detail', { year, site: 'NORD' });
        expect(Array.isArray(weekly.weeks)).toBe(true);
    });
    it('rejects a page size above the MCP cap', async () => {
        const parsed = await rpc('tools/call', { name: 'search_candidates', arguments: { first: 51 } });
        expect(parsed.error ?? parsed.result?.isError).toBeTruthy();
    });

    it('journalise chaque appel (outil, fiche, volume) sans PII', async () => {
        await callTool('list_users');
        await callTool('get_company', { id: 424242 }).catch(() => undefined);
        const [rows] = await pool.query<any[]>('SELECT * FROM mcp_audit_log ORDER BY id');
        const listUsers = rows.find((r) => r.tool === 'list_users');
        expect(listUsers).toMatchObject({ user_id: 0, status: 'ok', client_id: null });
        const company = rows.find((r) => r.tool === 'get_company');
        expect(company?.subject_ref).toBe('id:424242');
        expect(company?.args_hash).toHaveLength(32);
    });

    it('bloque les appels au-delà du quota quotidien', async () => {
        const values = Array.from({ length: DAILY_CALL_LIMIT }, () => "(0, 'list_users', 'h', 1, 'ok')").join(',');
        await pool.query(`INSERT INTO mcp_audit_log (user_id, tool, args_hash, result_count, status) VALUES ${values}`);
        const parsed = await rpc('tools/call', { name: 'list_users', arguments: {} });
        expect(parsed.result.isError).toBe(true);
        expect(parsed.result.content[0].text).toContain('Quota');
        const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM mcp_audit_log WHERE status = 'quota'");
        expect(Number(rows[0].n)).toBe(1);
    });
    it('ne renvoie pas un candidat sans consentement ai_processing', async () => {
        const id = `cand-noconsent-${Date.now()}`;
        await new CandidateService().create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.CC],
            status: CandidateStatus.SEEKING,
            identity: { full_name: 'Sans Consentement', email: `${id}@test.local`, phone: '0692000004' } as any,
            consentments: {
                data_processing: true,
                data_sharing: true,
                ai_processing: false,
                photo_processing: true,
                consent_date: new Date(),
                consent_version: '1',
            },
        } as any);

        expect(await callTool('get_candidate', { id })).toBeNull();
        expect(await callTool('get_candidate_by_email', { email: `${id}@test.local` })).toBeNull();
        expect(await callTool('list_candidate_history', { candidateId: id })).toBeNull();
        const list = await callTool<any[]>('search_candidates', { search: 'Sans Consentement' });
        expect(list).toHaveLength(0);
    });

    it("retire santé, contact d'urgence, réponses de tests et photo sans consentement photo", async () => {
        const id = `cand-redact-${Date.now()}`;
        await new CandidateService().create({
            _id: id,
            candidate_id: id,
            tp_types: [TitleProfessionalType.CC],
            status: CandidateStatus.SEEKING,
            identity: {
                full_name: 'Candidat Redact',
                email: `${id}@test.local`,
                phone: '0692000005',
                psh_referral_request: true,
                nationality: 3,
                born_in_france: false,
                residence_permit: true,
            } as any,
            emergency_contact: { full_name: 'Tiers Urgence', phone: '0692999999' },
            synthesis: { special_needs: 'amenagement', pedagogical_recommendations: { psh_specific_support: true } },
            classmarker: { percentage: 80, questions: [{ question: 'Q?', user_response: 'secret' }] },
            photo_link: 'https://photo.test/p.png',
            consentments: {
                data_processing: true,
                data_sharing: false,
                ai_processing: true,
                photo_processing: false,
                consent_date: new Date(),
                consent_version: '1',
            },
        } as any);

        const candidate = await callTool('get_candidate', { id });
        const json = JSON.stringify(candidate);
        for (const leaked of [
            'psh_',
            'nationality',
            'born_in_france',
            'residence_permit',
            'special_needs',
            'emergency_contact',
            'Tiers Urgence',
            'user_response',
            'photo.test',
        ]) {
            expect(json).not.toContain(leaked);
        }
        expect(candidate.classmarker.percentage).toBe(80);
    });
    it('pagine list_offers et list_needs_analysis', async () => {
        for (const tool of ['list_offers', 'list_needs_analysis']) {
            const page = await callTool(tool);
            expect(page).toMatchObject({ total: expect.any(Number), offset: 0 });
            expect(Array.isArray(page.items)).toBe(true);
            expect(page.items.length).toBeLessThanOrEqual(50);
            const rejected = await rpc('tools/call', { name: tool, arguments: { first: 51 } });
            expect(rejected.error ?? rejected.result?.isError).toBeTruthy();
        }
    });
});
