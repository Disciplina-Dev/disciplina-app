import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CandidateService } from '../../services/CandidateService';
import { CandidateHistoryService } from '../../services/CandidateHistoryService';
import { OfferService } from '../../services/OfferService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { MAX_PAGE_SIZE } from '../limits';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';
import { consentedIds, exposeCandidate, exposeCandidates } from '../candidateExposure';

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
        'Liste / recherche les candidats (filtre par nom/email en entrée ; sortie « Prénom N. ») ; mêmes champs que get_candidate. Pagination cursor-based.',
        {
            search: z.string().optional().describe('Terme de recherche'),
            first: z.number().int().positive().max(MAX_PAGE_SIZE).optional().describe('Nombre max (défaut 50)'),
            after: z.string().optional().describe('Cursor de pagination'),
        },
        CANDIDATE_SCOPE,
        async ({ search, first, after }) =>
            toolResult(exposeCandidates(await candidates.findPageReadOnly(first ?? 50, after, search))),
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
        "Historique / suivi RH d'un candidat (événements automatiques et manuels).",
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) =>
            toolResult(
                (await consentedIds([candidateId])).has(candidateId)
                    ? await candidateHistory.findByCandidate(candidateId)
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
