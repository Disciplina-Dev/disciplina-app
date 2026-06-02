import * as cheerio from 'cheerio';
import { logger } from '../logger';
import { ScrapedPage } from './types';

export class ScraperService {
    private readonly headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
    };

    /**
     * Strip markup/noise from raw HTML and return collapsed plain text.
     */
    clean(html: string): string {
        try {
            const $ = cheerio.load(html);
            $('script, style, noscript, svg, head, link, meta, iframe').remove();
            const text = $('body').length ? $('body').text() : $.root().text();
            return text.replace(/\s+/g, ' ').trim();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error: errorMsg }, 'Scraper clean failed');
            return '';
        }
    }

    /**
     * Collect absolute hrefs from anchor tags in raw HTML.
     * Relative links are resolved against baseUrl; malformed ones are skipped.
     */
    extractLinks(html: string, baseUrl: string): string[] {
        try {
            const $ = cheerio.load(html);
            const links = new Set<string>();
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;
                try {
                    const abs = new URL(href, baseUrl).toString();
                    if (abs.startsWith('http')) links.add(abs);
                } catch {
                    // ignore malformed hrefs
                }
            });
            return [...links];
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error: errorMsg }, 'Scraper extractLinks failed');
            return [];
        }
    }

    async scrape(urls: string[]): Promise<ScrapedPage[]> {
        const results: ScrapedPage[] = [];

        for (let i = 0; i < urls.length; i += 3) {
            const batch = urls.slice(i, i + 3);
            const promises = batch.map((url) => this.fetchPage(url));
            const settled = await Promise.allSettled(promises);

            for (let j = 0; j < settled.length; j++) {
                const result = settled[j];
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                }
            }
        }

        return results;
    }

    private async fetchPage(url: string): Promise<ScrapedPage | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                headers: this.headers,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                logger.warn({ url, status: response.status }, 'Failed to fetch URL');
                return null;
            }

            const html = await response.text();
            return { url, html };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ url, error: errorMsg }, 'Scraper error for URL');
            return null;
        }
    }
}
