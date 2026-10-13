import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AlternantService } from '../../services/AlternantService';
import { SessionService } from '../../services/SessionService';
import { RuptureService } from '../../services/RuptureService';
import { PedaDraftHistoryRepository } from '../../repositories/mysql/PedaDraftHistoryRepository';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { MAX_PAGE_SIZE, pageOf } from '../limits';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';
import { AlternantSequence, AlternantSequenceStatus } from '../../types/alternant.types';
import { sessionToGql } from '../../services/mappers/session.mapper';
import {
    MIN_SEARCH_LENGTH,
    alternantLabel,
    consentedAlternants,
    escapeRegex,
    maskCount,
    maskCounts,
    ruptureCategory,
    toAlternantDto,
} from '../pedaExposure';

// Espace pédagogique : réservé au rôle PEDA et aux responsables (le GraphQL peda, lui, est
// ouvert à tout EMPLOYEE — constat M6, on ne reproduit pas cette ouverture côté MCP).
const PEDA_SCOPE = mcpToolScope(Permission.RESPONSABLE, [JobRole.PEDA]);

const alternants = new AlternantService();
const sessions = new SessionService();
const ruptures = new RuptureService();
const draftHistory = new PedaDraftHistoryRepository();

const DAY_MS = 24 * 60 * 60 * 1000;
const firstArg = z.number().int().positive().max(MAX_PAGE_SIZE).optional().describe('Nombre max (défaut 50)');
const offsetArg = z.number().int().min(0).optional().describe('Décalage de pagination (défaut 0)');
const yearArg = z.number().int().min(2000).max(2100).describe('Année civile');

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

const inYear = (d: Date | string, y: number): boolean => new Date(d).getUTCFullYear() === y;

/** Alternants (actifs + archivés) visibles du MCP, indexés par id. */
async function visibleAlternants(): Promise<Map<string, Awaited<ReturnType<typeof alternants.findAll>>[number]>> {
    const all = await consentedAlternants(await alternants.findAll(undefined, true));
    return new Map(all.map((a) => [a._id, a]));
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of rows) out[key(row)] = (out[key(row)] ?? 0) + 1;
    return out;
}

function sequenceCounts(seqs: AlternantSequence[], today: Date) {
    return {
        total: seqs.length,
        done: seqs.filter((s) => s.status === AlternantSequenceStatus.DONE).length,
        notDone: seqs.filter((s) => s.status === AlternantSequenceStatus.NOT_DONE).length,
        pending: seqs.filter((s) => s.status === AlternantSequenceStatus.PENDING).length,
        overdue: seqs.filter(
            (s) => s.status === AlternantSequenceStatus.PENDING && new Date(s.prevue_le).getTime() < today.getTime(),
        ).length,
    };
}

async function sequenceDueList(from: Date | null, to: Date | null, today: Date, limit?: number, skip?: number) {
    const seqs = await alternants.findPendingSequences(from, to);
    const owners = await consentedAlternants(await alternants.findByIds([...new Set(seqs.map((s) => s.alternant_id))]));
    const byId = new Map(owners.map((a) => [a._id, a]));
    const items = seqs
        .filter((s) => byId.has(s.alternant_id))
        .map((s) => {
            const owner = byId.get(s.alternant_id)!;
            return {
                alternantId: owner._id,
                label: alternantLabel(owner),
                session: owner.session,
                sessionId: owner.session_id ?? null,
                numero: s.numero,
                prevueLe: new Date(s.prevue_le).toISOString(),
                daysLate: Math.max(0, Math.floor((today.getTime() - new Date(s.prevue_le).getTime()) / DAY_MS)),
                contacts: s.contacts,
            };
        });
    return pageOf(items, limit, skip);
}

export function registerPedaTools(server: McpServer): void {
    readTool(
        server,
        'list_sessions',
        'Sessions de formation (nom, filière, jour de cours, dates). Aucune donnée personnelle.',
        {
            search: z.string().optional().describe('Nom ou filière'),
            first: firstArg,
            offset: offsetArg,
        },
        PEDA_SCOPE,
        async ({ search, first, offset }) =>
            toolResult(
                pageOf(
                    (await sessions.findAll(search)).map((s) => omitCount(sessionToGql(s))),
                    first,
                    offset,
                ),
            ),
    );

    readTool(
        server,
        'get_session',
        'Fiche session par id (nom, filière, jour de cours, dates).',
        { id: z.string().describe('Id de la session') },
        PEDA_SCOPE,
        async ({ id }) => {
            const session = await sessions.findById(id);
            return toolResult(session ? omitCount(sessionToGql(session)) : null);
        },
    );

    readTool(
        server,
        'session_stats',
        'Effectifs et avancement des séquences d’accompagnement (SA) par session. Agrégats : effectifs < 5 masqués.',
        { sessionId: z.string().optional().describe('Restreint à une session') },
        PEDA_SCOPE,
        async ({ sessionId }) => {
            const today = startOfToday();
            const visible = [...(await visibleAlternants()).values()].filter(
                (a) => !sessionId || a.session_id === sessionId,
            );
            const seqs = await alternants.findSequencesByAlternantIds(visible.map((a) => a._id));
            const sessionOf = new Map(visible.map((a) => [a._id, a.session_id ?? 'hors-session']));
            const groups = [...new Set(visible.map((a) => a.session_id ?? 'hors-session'))];
            return toolResult(
                groups.map((group) => {
                    const members = visible.filter((a) => (a.session_id ?? 'hors-session') === group);
                    const own = seqs.filter((s) => sessionOf.get(s.alternant_id) === group);
                    return {
                        sessionId: group === 'hors-session' ? null : group,
                        session: members[0]?.session ?? null,
                        alternants: maskCounts({
                            active: members.filter((a) => !a.archived_at).length,
                            archived: members.filter((a) => !!a.archived_at).length,
                        }),
                        sequences: maskCounts(sequenceCounts(own, today)),
                    };
                }),
            );
        },
    );

    readTool(
        server,
        'list_sequences_overdue',
        'SA en retard (date prévue dépassée, non réalisées), les plus anciennes d’abord. Alternants identifiés par « Prénom N. ».',
        { first: firstArg, offset: offsetArg },
        PEDA_SCOPE,
        async ({ first, offset }) => {
            const today = startOfToday();
            return toolResult(await sequenceDueList(null, today, today, first, offset));
        },
    );

    readTool(
        server,
        'list_sequences_upcoming',
        'SA à venir dans les N prochains jours (défaut 14, aligné sur le dashboard péda).',
        {
            days: z.number().int().min(1).max(90).optional().describe('Horizon en jours (défaut 14)'),
            first: firstArg,
            offset: offsetArg,
        },
        PEDA_SCOPE,
        async ({ days, first, offset }) => {
            const today = startOfToday();
            const to = new Date(today.getTime() + (days ?? 14) * DAY_MS);
            return toolResult(await sequenceDueList(today, to, today, first, offset));
        },
    );

    readTool(
        server,
        'list_alternant_sequences',
        'SA d’un alternant (numéro, date prévue, statut, date de réalisation, contacts mentor/alternant/formateur faits).',
        { alternantId: z.string().describe('Id de l’alternant') },
        PEDA_SCOPE,
        async ({ alternantId }) => {
            const [owner] = await consentedAlternants(await alternants.findByIds([alternantId]));
            if (!owner) return toolResult(null);
            return toolResult(
                (await alternants.findSequences(alternantId)).map((s) => ({
                    id: s._id,
                    alternantId,
                    numero: s.numero,
                    prevueLe: s.prevue_le,
                    status: s.status,
                    realiseeLe: s.realisee_le ?? null,
                    contacts: s.contacts,
                    archived: !!s.archived_at,
                })),
            );
        },
    );

    readTool(
        server,
        'list_alternants',
        'Liste / recherche des alternants (nom ou prénom, 3 caractères min.). Résultat minimisé : id, « Prénom N. », session, entreprise, dates de contrat. Seuls les alternants dont le candidat a consenti au traitement IA sont visibles.',
        {
            search: z.string().optional().describe('Nom, prénom, session ou entreprise (3 caractères min.)'),
            sessionId: z.string().optional().describe('Restreint à une session'),
            includeArchived: z.boolean().optional().describe('Inclure les archivés (défaut false)'),
            first: firstArg,
            offset: offsetArg,
        },
        PEDA_SCOPE,
        async ({ search, sessionId, includeArchived, first, offset }) => {
            const needle = search?.trim();
            if (needle !== undefined && needle !== '' && needle.length < MIN_SEARCH_LENGTH) {
                throw new Error(`La recherche demande au moins ${MIN_SEARCH_LENGTH} caractères`);
            }
            const rows = sessionId
                ? (await alternants.findBySessionId(sessionId, includeArchived ?? false)).filter(
                      (a) => !needle || matches(a, needle),
                  )
                : await alternants.findAll(needle ? escapeRegex(needle) : undefined, includeArchived ?? false);
            return toolResult(pageOf((await consentedAlternants(rows)).map(toAlternantDto), first, offset));
        },
    );

    readTool(
        server,
        'get_alternant',
        'Fiche alternant minimisée par id (« Prénom N. », session, entreprise, dates de contrat, archivé).',
        { id: z.string().describe('Id de l’alternant') },
        PEDA_SCOPE,
        async ({ id }) => {
            const [owner] = await consentedAlternants(await alternants.findByIds([id]));
            return toolResult(owner ? toAlternantDto(owner) : null);
        },
    );

    readTool(
        server,
        'list_ruptures',
        'Ruptures de contrat d’un mois : alternant (« Prénom N. »), session, date, catégorie de motif, poursuite de formation. Jamais le détail libre ni l’entreprise.',
        {
            year: yearArg,
            month: z.number().int().min(1).max(12).describe('Mois (1-12)'),
            first: firstArg,
            offset: offsetArg,
        },
        PEDA_SCOPE,
        async ({ year, month, first, offset }) => {
            const rows = await ruptures.findByMonth(year, month);
            const owners = await consentedAlternants(rows.flatMap((r) => (r.alternant ? [r.alternant] : [])));
            const ok = new Set(owners.map((a) => a._id));
            const items = rows
                .filter((r) => r.alternant && ok.has(r.alternant._id))
                .map(({ rupture, alternant }) => ({
                    id: rupture._id,
                    alternantId: rupture.alternant_id,
                    label: alternantLabel(alternant!),
                    session: alternant!.session,
                    sessionId: alternant!.session_id ?? null,
                    dateRupture: new Date(rupture.date_rupture).toISOString(),
                    category: ruptureCategory(rupture.motif),
                    poursuitFormation: rupture.poursuit_formation,
                }));
            return toolResult(pageOf(items, first, offset));
        },
    );

    readTool(
        server,
        'rupture_stats',
        'Ruptures de l’année par catégorie de motif et par mois. Agrégats : effectifs < 5 masqués.',
        { year: yearArg },
        PEDA_SCOPE,
        async ({ year }) => {
            const visible = await visibleAlternants();
            const rows = (await ruptures.findByYear(year)).filter((r) => visible.has(r.alternant_id));
            return toolResult({
                year,
                total: maskCount(rows.length),
                byCategory: maskCounts(countBy(rows, (r) => ruptureCategory(r.motif))),
                byMonth: maskCounts(countBy(rows, (r) => String(new Date(r.date_rupture).getUTCMonth() + 1))),
                poursuitFormation: maskCounts({
                    yes: rows.filter((r) => r.poursuit_formation).length,
                    no: rows.filter((r) => !r.poursuit_formation).length,
                }),
            });
        },
    );

    readTool(
        server,
        'peda_kpi_overview',
        'Synthèse péda de l’année : effectifs, avancement des SA (réalisées, en retard…), ruptures. Agrégats : effectifs < 5 masqués.',
        { year: yearArg },
        PEDA_SCOPE,
        async ({ year }) => {
            const today = startOfToday();
            const visible = await visibleAlternants();
            const seqs = (await alternants.findSequencesByAlternantIds([...visible.keys()])).filter((s) =>
                inYear(s.prevue_le, year),
            );
            const ruptureRows = (await ruptures.findByYear(year)).filter((r) => visible.has(r.alternant_id));
            const all = [...visible.values()];
            return toolResult({
                year,
                alternants: maskCounts({
                    active: all.filter((a) => !a.archived_at).length,
                    archived: all.filter((a) => !!a.archived_at).length,
                }),
                sequences: maskCounts(sequenceCounts(seqs, today)),
                ruptures: maskCount(ruptureRows.length),
            });
        },
    );

    readTool(
        server,
        'peda_draft_stats',
        'Volume de brouillons de relance d’absence générés dans l’année, par niveau et par mois. Aucun destinataire. Effectifs < 5 masqués.',
        { year: yearArg },
        PEDA_SCOPE,
        async ({ year }) =>
            toolResult(
                (await draftHistory.countByLevelAndMonth(year)).map((r) => ({
                    level: r.level,
                    month: r.month,
                    count: maskCount(r.count),
                })),
            ),
    );
}

function matches(a: { first_name: string; last_name: string }, needle: string): boolean {
    const n = needle.toLowerCase();
    return a.first_name.toLowerCase().includes(n) || a.last_name.toLowerCase().includes(n);
}

/** Le décompte d'alternants d'une session est servi par `session_stats` (masqué). */
function omitCount(session: object): object {
    const { alternantCount: _count, ...rest } = session as Record<string, unknown>;
    return rest;
}
