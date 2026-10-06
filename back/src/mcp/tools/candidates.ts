import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CandidateService } from '../../services/CandidateService';
import { CandidateHistoryService } from '../../services/CandidateHistoryService';
import { OfferService } from '../../services/OfferService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';
import { MASKED_SSN } from '../../external/crypto/ssn-cipher';
import { Candidate } from '../../types/candidate.types';

// Candidats : donnée RH (miroir des guards GraphQL candidate, majoritairement `[RH]`).
const CANDIDATE_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.RH]);

const candidates = new CandidateService();
const candidateHistory = new CandidateHistoryService();
const offerService = new OfferService();

// Même masquage que `candidateToGql` : le n° de sécu (chiffré) ne sort jamais.
function maskSsn<T extends Candidate | null>(candidate: T): T {
    if (!candidate?.identity?.social_security_number) return candidate;
    return { ...candidate, identity: { ...candidate.identity, social_security_number: MASKED_SSN } } as T;
}

export function registerCandidateTools(server: McpServer): void {
    readTool(
        server,
        'get_candidate',
        'Récupère la fiche candidat complète par son id (MongoDB) : identité, coordonnées, TP visé, secteurs souhaités, mobilité, synthèse.',
        { id: z.string().describe('Id du candidat (ObjectId Mongo)') },
        CANDIDATE_SCOPE,
        async ({ id }) => toolResult(maskSsn(await candidates.findById(id))),
    );

    readTool(
        server,
        'search_candidates',
        'Liste / recherche les candidats (nom, email…). Pagination cursor-based.',
        {
            search: z.string().optional().describe('Terme de recherche'),
            first: z.number().int().positive().max(200).optional().describe('Nombre max (défaut 50)'),
            after: z.string().optional().describe('Cursor de pagination'),
        },
        CANDIDATE_SCOPE,
        async ({ search, first, after }) =>
            toolResult((await candidates.findPage(first ?? 50, after, search)).map(maskSsn)),
    );

    readTool(
        server,
        'get_candidate_by_email',
        'Récupère un candidat par son adresse email.',
        { email: z.string().describe('Email du candidat') },
        CANDIDATE_SCOPE,
        async ({ email }) => toolResult(maskSsn(await candidates.findByEmail(email))),
    );

    readTool(
        server,
        'list_candidate_history',
        "Historique / suivi RH d'un candidat (événements automatiques et manuels).",
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) => toolResult(await candidateHistory.findByCandidate(candidateId)),
    );

    readTool(
        server,
        'candidate_placement',
        "Placement courant d'un candidat (immersion ou contrat) dérivé des offres.",
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) => toolResult(await offerService.getCandidatePlacement(candidateId)),
    );

    readTool(
        server,
        'candidate_matched_jobs',
        'Ids des offres sur lesquelles le candidat est retenu (matché).',
        { candidateId: z.string().describe('Id du candidat') },
        CANDIDATE_SCOPE,
        async ({ candidateId }) => toolResult(await offerService.getMatchedOfferIds(candidateId)),
    );
}
