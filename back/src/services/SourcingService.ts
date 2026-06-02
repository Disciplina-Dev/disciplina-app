import { DdgService } from '../external/ddg/ddg.service';
import { ScraperService } from '../external/scraper/scraper.service';
import { OllamaService } from '../external/ollama/ollama.service';
import { DdgResult } from '../external/ddg/types';
import { ScrapedPage } from '../external/scraper/types';
import { ContactInfo } from '../rest/sourcing/types';
import { logger } from '../external/logger';

const MODEL = 'qwen2.5:3b';
const MAX_PAGE_CHARS = 6000;
const MAX_LINKS = 12;

// Only the most pertinent professional profiles and business directories,
// matched on the URL. Everything else (other socials, contact pages) is dropped.
const PROFESSIONAL_LINKS: { pattern: RegExp; label: string }[] = [
    { pattern: /linkedin\.com/i, label: 'LinkedIn' },
    { pattern: /pappers\.fr/i, label: 'Pappers' },
    { pattern: /societe\.com/i, label: 'Societe.com' },
    { pattern: /pagesjaunes\.fr/i, label: 'Pages Jaunes' },
];

export class SourcingService {
    private ddgService: DdgService;
    private scraperService: ScraperService;
    private ollamaService: OllamaService;

    constructor() {
        this.ddgService = new DdgService();
        this.scraperService = new ScraperService();
        this.ollamaService = new OllamaService();
    }

    async findContacts(name: string, address?: string): Promise<ContactInfo[]> {
        // 1. Generate a search query with the LLM
        const query = await this.generateQuery(name, address);
        logger.info({ query }, 'Sourcing query generated');

        // 2. Web search
        const ddgResults = await this.ddgService.search(query);
        if (ddgResults.length === 0) return [];

        // 3. Fetch each page (cleaning happens per-page below)
        const pages = await this.scraperService.scrape(ddgResults.map((r) => r.url));

        // 4a. Pertinent links — LinkedIn, social, official website, contact pages.
        //     Collected deterministically and kept out of the LLM gate so they
        //     are never silently dropped, and survive even if no page extracts.
        const links = this.collectLinks(pages, ddgResults);

        // 4b. Extract textual contacts per page, accumulate
        const collected: ContactInfo[] = [];
        for (const page of pages) {
            const cleaned = this.scraperService.clean(page.html);
            if (!cleaned) continue;
            const extracted = await this.extractFromPage(name, cleaned);
            collected.push(...extracted);
        }
        const deduped = this.dedupe(collected);

        // 5. Validate the textual contacts; links bypass the gate.
        const validated = deduped.length > 0 ? await this.validate(name, address, deduped) : [];

        logger.info({ contacts: validated.length, links: links.length }, 'Sourcing finished');
        return this.dedupe([...validated, ...links]);
    }

    private async generateQuery(name: string, address?: string): Promise<string> {
        const role =
            'You are a search-query generator. Given a company name and optional address, ' +
            'output ONLY a single concise web search query (one line, no quotes, no explanation) ' +
            "that will find the company's official website, LinkedIn page and contact information " +
            '(phone, email, postal address, legal representative). Answer in French context.';
        const prompt = `Company name: ${name}\nAddress: ${address ?? 'unknown'}`;

        const reply = (await this.ollamaService.chat(prompt, role, MODEL)).trim();
        // Take the first non-empty line; fall back to a sensible default.
        const line = reply
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0);
        const fallback = `${name} ${address ?? ''} contact email téléphone LinkedIn`.trim();
        return line && line.length > 0 ? line : fallback;
    }

    private async extractFromPage(name: string, content: string): Promise<ContactInfo[]> {
        const role =
            'You are an assistant that extracts company contact information from text. ' +
            'Return ONLY a valid JSON array of objects with "name" and "value" string fields. ' +
            'No markdown, no explanation. If nothing relevant is found, return []. ' +
            'Example: [{"name":"Email","value":"contact@example.fr"},{"name":"Téléphone","value":"0262 12 34 56"}]';
        const prompt = `Company: ${name}\n\nExtract contact info from this page content:\n${content.slice(
            0,
            MAX_PAGE_CHARS,
        )}`;

        const reply = await this.ollamaService.chat(prompt, role, MODEL);
        return this.parseContacts(reply);
    }

    private async validate(
        name: string,
        address: string | undefined,
        candidates: ContactInfo[],
    ): Promise<ContactInfo[]> {
        const role =
            'You are a data validator. You receive a company name and a JSON array of contact-info ' +
            'candidates. Keep only entries that plausibly belong to that company and are well-formed ' +
            '(valid emails, phone numbers, postal addresses, person names). Return ONLY the cleaned ' +
            'JSON array. If none are good enough or you are not confident, return an empty array [].';
        const prompt = `Company: ${name}\nAddress: ${address ?? 'unknown'}\nCandidates: ${JSON.stringify(candidates)}`;

        const reply = await this.ollamaService.chat(prompt, role, MODEL);
        return this.parseContacts(reply);
    }

    /**
     * Classify search-result and in-page links into pertinent contact entries:
     * professional/social profiles, business directories, the official website
     * and likely contact/legal pages. Returns deduplicated entries (capped).
     */
    private collectLinks(pages: ScrapedPage[], ddgResults: DdgResult[]): ContactInfo[] {
        const entries: ContactInfo[] = [];
        const seen = new Set<string>();
        const add = (entry: ContactInfo | null): void => {
            if (!entry) return;
            const key = `${entry.name}|${entry.value}`.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            entries.push(entry);
        };

        // Search results + landed pages → official website / directory candidates.
        for (const url of [...ddgResults.map((r) => r.url), ...pages.map((p) => p.url)]) {
            add(this.classifyLink(url, true));
        }

        // In-page links → professional/social profiles and contact pages only.
        for (const page of pages) {
            for (const link of this.scraperService.extractLinks(page.html, page.url)) {
                add(this.classifyLink(link, false));
            }
        }

        return entries.slice(0, MAX_LINKS);
    }

    private classifyLink(url: string, allowWebsite: boolean): ContactInfo | null {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return null;
        }

        for (const { pattern, label } of PROFESSIONAL_LINKS) {
            if (pattern.test(url)) return { name: label, value: this.normalizeUrl(parsed) };
        }
        if (allowWebsite && (parsed.pathname === '/' || parsed.pathname === '')) {
            return { name: 'Site web', value: this.normalizeUrl(parsed) };
        }
        return null;
    }

    private normalizeUrl(u: URL): string {
        return `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/$/, '');
    }

    private parseContacts(raw: string): ContactInfo[] {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) return [];
        try {
            const parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
                .map((c) => ({ name: c.name.trim(), value: c.value.trim() }))
                .filter((c) => c.name && c.value);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error: errorMsg }, 'Failed to parse contacts JSON');
            return [];
        }
    }

    private dedupe(contacts: ContactInfo[]): ContactInfo[] {
        const seen = new Set<string>();
        const out: ContactInfo[] = [];
        for (const c of contacts) {
            const key = `${c.name.toLowerCase()}|${c.value.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(c);
        }
        return out;
    }
}
