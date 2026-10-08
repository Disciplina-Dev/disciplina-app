import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OfferService } from '../../services/OfferService';
import { OfferHistoryService } from '../../services/OfferHistoryService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';

// Offres / matching : travaillées par la RH, mais consultées côté commercial
// (fiche entreprise derrière une offre).
const OFFER_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.COMMERCIAL, JobRole.RH]);

// Historique d'offre : réservé RH (miroir du guard GraphQL `offerHistory`).
const OFFER_HISTORY_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.RH]);

const offerService = new OfferService();
const offerHistory = new OfferHistoryService();

export function registerOfferTools(server: McpServer): void {
    readTool(
        server,
        'list_offers',
        'Liste toutes les offres / postes (MongoDB) avec leurs critères de matching et statut.',
        {},
        OFFER_SCOPE,
        async () => toolResult(await offerService.findAll(true)),
    );

    readTool(
        server,
        'get_offer',
        'Récupère une offre par id, avec les candidats suggérés par le matching automatique selon ses critères.',
        { id: z.string().describe("Id de l'offre") },
        OFFER_SCOPE,
        async ({ id }) => toolResult(await offerService.find(id)),
    );

    readTool(
        server,
        'offer_company_info',
        'Fiche entreprise + Analyse du Besoin liées à une offre (résolution directe ou fallback par nom).',
        { offerId: z.string().describe("Id de l'offre") },
        OFFER_SCOPE,
        async ({ offerId }) => toolResult(await offerService.getCompanyInfo(offerId)),
    );

    readTool(
        server,
        'list_offer_history',
        "Historique / suivi d'une offre (événements automatiques et commentaires manuels), du plus récent au plus ancien.",
        { offerId: z.string().describe("Id de l'offre") },
        OFFER_HISTORY_SCOPE,
        async ({ offerId }) =>
            toolResult(
                (await offerHistory.findByOffer(offerId)).map((e) => ({
                    id: e._id,
                    offerId: e.offer_id,
                    firstName: e.first_name,
                    lastName: e.last_name,
                    text: e.text,
                    ownerEmail: e.owner_email,
                    createdAt: e.created_at,
                })),
            ),
    );
}
