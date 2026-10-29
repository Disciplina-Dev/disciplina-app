import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CandidateService } from '../../services/CandidateService';
import { CandidateHistoryService } from '../../services/CandidateHistoryService';
import { OfferService } from '../../services/OfferService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { MAX_PAGE_SIZE, pageOf } from '../limits';
import { buildConnection } from '../../services/pagination';
import { encodeCandidateCursor } from '../../repositories/mongo/CandidateRepository';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';
import { consentedIds, exposeCandidate, exposeCandidates, toCandidateHistoryDto } from '../candidateExposure';

// Candidats : donnée RH (miroir des guards GraphQL candidate, majoritairement `[RH]`).
const CANDIDATE_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.RH]);

const candidates = new CandidateService();
const candidateHistory = new CandidateHistoryService();
const offerService = new OfferService();

export function registerCandidateTools(server: McpServer): void {
    readTool(
        server,
        'get_candidate',
        'Fiche candidat (liste blanche RGPD) par son id : « Prénom N. », commune, indicateur mineur, TP visé, secteurs, parcours, mobilité, synthèse, immersion/contrat. Jamais d’email, téléphone, adresse, date de naissance, n° de sécu, santé, liens de documents ni résultats de tests.',
        { id: z.string().describe('Id du candidat (ObjectId Mongo)') },
        CANDIDATE_SCOPE,
        async ({ id }) => toolResult(exposeCandidate(await candidates.findByIdReadOnly(id))),
    );

    readTool(
        server,
        'search_candidates',
        'Liste / recherche les candidats (filtre par nom/email en entrée ; sortie « Prénom N. ») ; mêmes champs que get_candidate. Renvoie { items, pageInfo } (au plus `first` fiches) ; `after` = pageInfo.endCursor, ignoré quand `search` est fourni.',
        {
            search: z.string().optional().describe('Terme de recherche'),
            first: z.number().int().positive().max(MAX_PAGE_SIZE).optional().describe('Nombre max (défaut 50)'),
            after: z.string().optional().describe('Cursor de pagination'),
        },
        CANDIDATE_SCOPE,
        async ({ search, first, after }) => {
            const size = first ?? MAX_PAGE_SIZE;
            // findPage renvoie size + 1 lignes (look-ahead) ou, en recherche, tous les résultats : on tranche ici.
            const page = buildConnection(
                await candidates.findPageReadOnly(size, after, search),
                encodeCandidateCursor,
                size,
            );
            return toolResult({
                items: exposeCandidates(page.edges.map((e) => e.node)),
                pageInfo: { hasNextPage: page.pageInfo.hasNextPage, endCursor: page.pageInfo.endCursor },
            });
        },
    );

    readTool(
        server,
        'get_candidate_by_email',
        'Récupère un candidat par son adresse email (l’email n’est pas renvoyé) ; mêmes champs que get_candidate.',
        { email: z.string().describe('Email du candidat') },
        CANDIDATE_SCOPE,
        async ({ email }) => toolResult(exposeCandidate(await candidates.findByEmail(email))),
    );

    readTool(
        server,
        'list_candidate_history',
        "Chronologie du suivi RH d'un candidat (type d'événement et date, paginée). Sans texte libre ni auteur : le contenu des notes n'est pas exposé.",
        {
            candidateId: z.string().describe('Id du candidat'),
            first: z.number().int().positive().max(MAX_PAGE_SIZE).optional().describe('Nombre max (défaut 50)'),
            offset: z.number().int().min(0).optional().describe('Décalage de pagination (défaut 0)'),
        },
        CANDIDATE_SCOPE,
        async ({ candidateId, first, offset }) =>
            toolResult(
                (await consentedIds([candidateId])).has(candidateId)
                    ? pageOf(
                          (await candidateHistory.findByCandidate(candidateId)).map(toCandidateHistoryDto),
                          first,
                          offset,
                      )
                    : null,
            ),
    );

    readTool(
        server,
        'candidate_placement',
        "Placement courant d'un candidat (immersion ou contrat) dérivé des offres.",
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) =>
            toolResult(
                (await consentedIds([candidateId])).has(candidateId)
                    ? await offerService.getCandidatePlacement(candidateId)
                    : null,
            ),
    );

    readTool(
        server,
        'candidate_matched_jobs',
        'Ids des offres sur lesquelles le candidat est retenu (matché).',
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) =>
            toolResult(
                (await consentedIds([candidateId])).has(candidateId)
                    ? await offerService.getMatchedOfferIds(candidateId)
                    : null,
            ),
    );
}
