import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentMcpUser } from './context';
import { checkToolScope, McpToolScope } from './rbac';
import { McpAuditStore, hashArgs, subjectRef } from './auditStore';
import { DAILY_CALL_LIMIT, DAILY_RECORD_LIMIT } from './limits';
import { logger } from '../external/logger/logger';

const auditStore = new McpAuditStore();
// Alerte (log warn) dès que 80 % du quota quotidien est consommé : signal d'export en masse.
const ALERT_RATIO = 0.8;

// Nombre d'enregistrements sortis : taille du tableau racine (ou de `items` d'une page), sinon 1 (fiche) / 0 (null).
function countRecords(result: ToolResult): number {
    try {
        const parsed: unknown = JSON.parse(result.content[0]?.text ?? 'null');
        if (Array.isArray(parsed)) return parsed.length;
        const items = (parsed as { items?: unknown } | null)?.items;
        if (Array.isArray(items)) return items.length;
        return parsed === null ? 0 : 1;
    } catch {
        return 0;
    }
}

type Shape = Record<string, z.ZodTypeAny>;
type Args<S extends Shape> = { [K in keyof S]: z.infer<S[K]> };
type ToolResult = { content: { type: 'text'; text: string }[] };

/**
 * Register a read-only tool.
 *
 * `scope` (McpToolScope) est vérifié au moment de l'appel via currentMcpUser() :
 * si l'utilisateur courant n'a pas la permission minimale ni un rôle métier
 * autorisé, l'outil répond un résultat d'erreur MCP (isError) — jamais une
 * exception qui casserait la session OAuth.
 *
 * The MCP SDK's `registerTool` runs a heavy generic inference over the Zod raw
 * shape that trips TS2589 ("type instantiation is excessively deep"). We keep our
 * own shallow inference for the handler args and hand the SDK an untyped config,
 * so callers still get fully typed `args` while the deep SDK generic is bypassed.
 */
export function readTool<S extends Shape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: S,
    scope: McpToolScope,
    handler: (args: Args<S>) => Promise<ToolResult>,
): void {
    server.registerTool(
        name,
        { description, inputSchema } as never,
        (async (args: Args<S>) => {
            const user = currentMcpUser();
            const entry = {
                userId: user?.id ?? 0,
                clientId: user?.clientId ?? null,
                tool: name,
                subjectRef: subjectRef(args),
                argsHash: hashArgs(args),
            };
            // Le journal ne doit jamais casser un appel d'outil : échec = log d'erreur seulement.
            const audit = async (resultCount: number, status: 'ok' | 'error' | 'denied' | 'quota') => {
                try {
                    await auditStore.record({ ...entry, resultCount, status });
                } catch (err) {
                    logger.error({ err }, 'MCP audit log write failed');
                }
            };

            const denied = checkToolScope(user, scope);
            if (denied) {
                await audit(0, 'denied');
                return { content: [{ type: 'text', text: denied }], isError: true };
            }

            try {
                const usage = await auditStore.usageLast24h(entry.userId);
                if (usage.calls >= DAILY_CALL_LIMIT || usage.records >= DAILY_RECORD_LIMIT) {
                    await audit(0, 'quota');
                    return {
                        content: [{ type: 'text', text: 'Quota quotidien MCP atteint : réessayez dans 24 h.' }],
                        isError: true,
                    };
                }
                if (
                    usage.records >= DAILY_RECORD_LIMIT * ALERT_RATIO ||
                    usage.calls >= DAILY_CALL_LIMIT * ALERT_RATIO
                ) {
                    logger.warn(
                        { userId: entry.userId, tool: name, ...usage },
                        'MCP volume alert: quota nearly reached',
                    );
                }
            } catch (err) {
                logger.error({ err }, 'MCP quota check failed');
            }

            try {
                const result = await handler(args);
                await audit(countRecords(result), 'ok');
                return result;
            } catch (err) {
                await audit(0, 'error');
                throw err;
            }
        }) as never,
    );
}
