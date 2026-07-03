import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CandidateService } from '../../services/CandidateService';
import { CandidateHistoryService } from '../../services/CandidateHistoryService';
import { JobService } from '../../services/JobService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const candidates = new CandidateService();
const candidateHistory = new CandidateHistoryService();
const jobs = new JobService();

export function registerCandidateTools(server: McpServer): void {
    readTool(
        server,
        'get_candidate',
        "Récupère la fiche candidat complète par son id (MongoDB) : identité, coordonnées, TP visé, secteurs souhaités, mobilité, synthèse.",
        { id: z.string().describe('Id du candidat (ObjectId Mongo)') },
        async ({ id }) => toolResult(await candidates.findById(id)),
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
        async ({ search, first, after }) => toolResult(await candidates.findPage(first ?? 50, after, search)),
    );

    readTool(
        server,
        'get_candidate_by_email',
        'Récupère un candidat par son adresse email.',
        { email: z.string().describe('Email du candidat') },
        async ({ email }) => toolResult(await candidates.findByEmail(email)),
    );

    readTool(
        server,
        'list_candidate_history',
        "Historique / suivi RH d'un candidat (événements automatiques et manuels).",
        { candidateId: z.string().describe('Id du candidat') },
        async ({ candidateId }) => toolResult(await candidateHistory.findByCandidate(candidateId)),
    );

    readTool(
        server,
        'candidate_placement',
        "Placement courant d'un candidat (immersion ou contrat) dérivé des offres.",
        { candidateId: z.string().describe('Id du candidat') },
        async ({ candidateId }) => toolResult(await jobs.getCandidatePlacement(candidateId)),
    );

    readTool(
        server,
        'candidate_matched_jobs',
        'Ids des offres sur lesquelles le candidat est retenu (matché).',
        { candidateId: z.string().describe('Id du candidat') },
        async ({ candidateId }) => toolResult(await jobs.getMatchedJobIds(candidateId)),
    );
}
