import { lookup } from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;

function isPrivateIPv4(address: string): boolean {
    const [a, b] = address.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 : link-local, dont les métadonnées cloud (169.254.169.254).
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 : CGNAT.
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

function isPrivateIPv6(address: string): boolean {
    const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
    if (normalized === '::1' || normalized === '::') return true;
    // fc00::/7 (ULA), fe80::/10 (link-local).
    if (/^f[cd]/.test(normalized)) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    // ::ffff:a.b.c.d — IPv4 mappée.
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return false;
}

export function isPrivateAddress(address: string): boolean {
    const version = net.isIP(address);
    if (version === 4) return isPrivateIPv4(address);
    if (version === 6) return isPrivateIPv6(address);
    return true;
}

/**
 * Rejette tout ce qui n'est pas une cible HTTP(S) publique.
 *
 * Le DNS est résolu ici : un domaine public pointant sur 127.0.0.1 doit être
 * refusé. Une fenêtre TOCTOU subsiste entre cette résolution et le fetch
 * (rebinding) — la fermer demanderait un agent HTTP validant l'IP à la connexion.
 */
export async function isPublicUrl(rawUrl: string): Promise<boolean> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const literal = parsed.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(literal)) return !isPrivateAddress(literal);

    try {
        const { address } = await lookup(parsed.hostname);
        return !isPrivateAddress(address);
    } catch {
        return false;
    }
}

export { MAX_REDIRECTS };
