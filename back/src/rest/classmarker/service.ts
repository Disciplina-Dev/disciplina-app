import crypto from 'crypto';
import { env } from '../../config/env';

export interface ClassMarkerLink {
    link_id: number;
    link_url_id: string;
    link_name: string;
    test_name: string;
}

export class MissingCredentialsError extends Error {
    constructor() {
        super('ClassMarker API credentials are not configured');
        this.name = 'MissingCredentialsError';
    }
}

export class ClassMarkerApiError extends Error {
    public status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'ClassMarkerApiError';
        this.status = status;
    }
}

interface RawLink {
    link: {
        link_name: string;
        link_id: number;
        link_url_id: string;
        assigned_tests?: Array<{ test: { test_name: string; test_id: number } }>;
    };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: ClassMarkerLink[]; expiresAt: number } | null = null;

function buildSignature(apiKey: string, apiSecret: string, timestamp: number): string {
    return crypto.createHash('sha256').update(apiKey + apiSecret + timestamp).digest('hex');
}

export async function getClassMarkerLinks(): Promise<ClassMarkerLink[]> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
        return cache.data;
    }

    const apiKey = env.CLASSMARKER_API_KEY;
    const apiSecret = env.CLASSMARKER_API_SECRET;
    if (!apiKey || !apiSecret) {
        throw new MissingCredentialsError();
    }

    const timestamp = Math.floor(now / 1000);
    const signature = buildSignature(apiKey, apiSecret, timestamp);
    const url = `https://api.classmarker.com/v1.json?api_key=${encodeURIComponent(apiKey)}&signature=${signature}&timestamp=${timestamp}`;

    let response: Response;
    try {
        response = await fetch(url, { method: 'GET' });
    } catch (err) {
        throw new ClassMarkerApiError(502, `Failed to reach ClassMarker: ${(err as Error).message}`);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ClassMarkerApiError(response.status, `ClassMarker responded ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { links?: RawLink[] };
    const links: ClassMarkerLink[] = (payload.links ?? []).map(({ link }) => ({
        link_id: link.link_id,
        link_url_id: link.link_url_id,
        link_name: link.link_name,
        test_name: link.assigned_tests?.[0]?.test?.test_name ?? '',
    }));

    cache = { data: links, expiresAt: now + CACHE_TTL_MS };
    return links;
}
