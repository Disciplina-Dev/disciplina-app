import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AlternantService } from '../../services/AlternantService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { pageOf } from '../limits';
import { PEDA_SCOPE, firstArg, offsetArg } from './peda';
import { consentedAlternants, isFilizInProgress, maskCount, maskPartition, toAlternantFilizDto } from '../pedaExposure';

// Suivi des dossiers Filiz des alternants, à partir du miroir local (`Alternant.filiz`) uniquement :
// aucun appel Filiz, aucune synchro. Classes et diplômes sont déjà couverts par `list_sessions` /
// `get_session` (une session est une classe Filiz). Mêmes règles que le périmètre péda : rôle PEDA /
// RESPONSABLE+, consentement `ai_processing`, « Prénom N. », effectifs < 5 masqués.
const alternants = new AlternantService();

export function registerFilizTools(server: McpServer): void {
    readTool(
        server,
        'get_alternant_filiz',
        'Avancement du dossier Filiz d’un alternant (étape courante, étape de départ, dossier en cours de remplissage, dates de mise à jour). Jamais d’identifiant Filiz ni de donnée de contact. `null` si l’alternant est invisible ou sans dossier Filiz.',
        { alternantId: z.string().describe('Id de l’alternant') },
        PEDA_SCOPE,
        async ({ alternantId }) => {
            const [owner] = await consentedAlternants(await alternants.findByIds([alternantId]));
            return toolResult(owner ? toAlternantFilizDto(owner) : null);
        },
    );

    readTool(
        server,
        'list_filiz_alternants',
        'Alternants d’une session (classe Filiz) avec l’avancement de leur dossier Filiz (« Prénom N. », étape, en cours de remplissage). Seuls les alternants consentis au traitement IA sont visibles.',
        {
            sessionId: z.string().describe('Id de la session (= classe Filiz)'),
            inProgressOnly: z.boolean().optional().describe('Uniquement les dossiers encore à leur étape de départ'),
            first: firstArg,
            offset: offsetArg,
        },
        PEDA_SCOPE,
        async ({ sessionId, inProgressOnly, first, offset }) => {
            const rows = await consentedAlternants(await alternants.findByFilizClassId(sessionId));
            const items = rows
                .filter((a) => !inProgressOnly || isFilizInProgress(a))
                .flatMap((a) => toAlternantFilizDto(a) ?? []);
            return toolResult(pageOf(items, first, offset));
        },
    );

    readTool(
        server,
        'filiz_folder_stats',
        'Dossiers Filiz d’une session : effectifs en cours de remplissage / avancés. Agrégats : effectifs de 1 à 4 masqués (+ masquage complémentaire anti-soustraction). Alternants archivés ou sans consentement IA exclus.',
        { sessionId: z.string().describe('Id de la session (= classe Filiz)') },
        PEDA_SCOPE,
        async ({ sessionId }) => {
            const rows = await consentedAlternants(await alternants.findByFilizClassId(sessionId));
            const inProgress = rows.filter(isFilizInProgress).length;
            return toolResult({
                sessionId,
                folders: maskCount(rows.length),
                ...maskPartition({ inProgress, other: rows.length - inProgress }),
            });
        },
    );
}
