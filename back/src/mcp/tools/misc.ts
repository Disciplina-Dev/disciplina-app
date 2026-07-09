import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SectorSettingsService } from '../../services/SectorSettingsService';
import { NotificationService } from '../../services/NotificationService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const sectorSettings = new SectorSettingsService();
const notifications = new NotificationService();

export function registerMiscTools(server: McpServer): void {
    readTool(
        server,
        'get_sector_settings',
        'Paramétrage secteur → localisation utilisé pour le matching.',
        {},
        async () => toolResult(await sectorSettings.list()),
    );

    readTool(
        server,
        'list_notifications',
        "Notifications in-app d'un utilisateur (par son id). Aucune donnée de compte/credential n'est exposée.",
        { userId: z.number().int().describe("Id de l'utilisateur destinataire") },
        async ({ userId }) => toolResult(await notifications.listForUser(userId)),
    );
}
