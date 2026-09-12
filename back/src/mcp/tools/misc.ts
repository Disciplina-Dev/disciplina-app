import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SectorSettingsService } from '../../services/SectorSettingsService';
import { NotificationService } from '../../services/NotificationService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { mcpToolScope, PERMISSION_DENIED_MSG } from '../rbac';
import { currentMcpUser } from '../context';
import { JobRole, Permission } from '../../types/user.types';

// Paramétrage de matching : utilisé par tous les métiers.
const SECTOR_SETTINGS_SCOPE = mcpToolScope(Permission.EMPLOYEE, [
    JobRole.COMMERCIAL,
    JobRole.RH,
    JobRole.PEDA,
    JobRole.AD,
    JobRole.GESTION,
]);

const sectorSettings = new SectorSettingsService();
const notifications = new NotificationService();

export function registerMiscTools(server: McpServer): void {
    readTool(
        server,
        'get_sector_settings',
        'Paramétrage secteur → localisation utilisé pour le matching.',
        {},
        SECTOR_SETTINGS_SCOPE,
        async () => toolResult(await sectorSettings.list()),
    );

    readTool(
        server,
        'list_notifications',
        "Notifications in-app d'un utilisateur (par son id). Aucune donnée de compte/credential n'est exposée.",
        { userId: z.number().int().describe("Id de l'utilisateur destinataire") },
        mcpToolScope(Permission.EMPLOYEE, []),
        // restreint : un collaborateur ne lit que SES notifications ; seuls les
        // ADMIN (incl. la clé MCP statique) peuvent interroger un autre compte.
        async ({ userId }) => {
            const me = currentMcpUser();
            if (!me || (me.permission !== Permission.ADMIN && userId !== me.id)) {
                return { content: [{ type: 'text', text: PERMISSION_DENIED_MSG }], isError: true };
            }
            return toolResult(await notifications.listForUser(userId));
        },
    );
}