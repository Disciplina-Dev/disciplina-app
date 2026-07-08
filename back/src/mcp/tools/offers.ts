import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OfferService } from '../../services/OfferService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const offerService = new OfferService();

export function registerOfferTools(server: McpServer): void {
    readTool(
        server,
        'list_offers',
        'Liste toutes les offres / postes (MongoDB) avec leurs critères de matching et statut.',
        {},
        async () => toolResult(await offerService.findAll()),
    );

    readTool(
        server,
        'get_offer',
        'Récupère une offre par id, avec les candidats suggérés par le matching automatique selon ses critères.',
        { id: z.string().describe("Id de l'offre") },
        async ({ id }) => toolResult(await offerService.find(id)),
    );

    readTool(
        server,
        'offer_company_info',
        'Fiche entreprise + Analyse du Besoin liées à une offre (résolution directe ou fallback par nom).',
        { offerId: z.string().describe("Id de l'offre") },
        async ({ offerId }) => toolResult(await offerService.getCompanyInfo(offerId)),
    );
}
