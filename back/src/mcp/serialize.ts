/**
 * Defensive serialization for the read-only MCP server.
 *
 * The domain objects returned by services are already camelCase and generally
 * free of secrets, but this strips any key that looks credential-bearing before
 * it ever reaches the LLM — belt-and-suspenders for "expose everything but never
 * a secret".
 */

const SENSITIVE_KEY = /(password|passwd|secret|token|hash|salt|credential|apikey|api_key|privatekey|private_key|encryptionkey)/i;

function scrub(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_KEY.test(k)) continue;
            out[k] = scrub(v);
        }
        return out;
    }
    return value;
}

/** Wrap any service result into an MCP text-content payload (pretty JSON). */
export function toolResult(data: unknown): { content: { type: 'text'; text: string }[] } {
    const safe = scrub(data);
    const text = safe === null || safe === undefined ? 'null' : JSON.stringify(safe, null, 2);
    return { content: [{ type: 'text', text }] };
}
