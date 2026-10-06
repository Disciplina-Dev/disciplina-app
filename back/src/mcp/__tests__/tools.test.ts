import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../config/env';
import pool from '../../db/mysql/connection';
import { truncateMysql } from '../../../test/helpers/db';
import { CandidateService } from '../../services/CandidateService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { OfferHistoryService } from '../../services/OfferHistoryService';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
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
        expect(names).toHaveLength(33);
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
                ai_processing: false,
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
        expect(entries[0].firstName).toBe('Jean');
        expect(typeof entries[0].createdAt).toBe('string');
        expect(entries[1].ownerEmail).toBeNull();
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
});
