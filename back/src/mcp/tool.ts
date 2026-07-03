import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type Shape = Record<string, z.ZodTypeAny>;
type Args<S extends Shape> = { [K in keyof S]: z.infer<S[K]> };
type ToolResult = { content: { type: 'text'; text: string }[] };

/**
 * Register a read-only tool.
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
    handler: (args: Args<S>) => Promise<ToolResult>,
): void {
    server.registerTool(
        name,
        { description, inputSchema } as never,
        handler as never,
    );
}
