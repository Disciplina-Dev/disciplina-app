import * as cheerio from 'cheerio';
import { logger } from '../logger';
import { DdgResult } from './types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DdgService {
    private readonly headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        Referer: 'https://duckduckgo.com/',
    };

    async search(query: string): Promise<DdgResult[]> {
        await sleep(2000);
        try {
            const params = new URLSearchParams({ q: query, kl: 'fr-fr' });
            const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
                headers: this.headers,
            });

            const html = await response.text();
            const $ = cheerio.load(html);
            const results: DdgResult[] = [];

            $('.result__body').each((_, el) => {
                const title = $(el).find('.result__title').text().trim();
                const rawUrl = $(el).find('.result__url').text().trim();
                const description = $(el).find('.result__snippet').text().trim();

                if (rawUrl) {
                    results.push({
                        title,
                        url: rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`,
                        description,
                    });
                }
            });

            return results.slice(0, 5);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, query }, 'DDG search failed');
            throw new Error(`Search failed: ${errorMsg}`);
        }
    }
}
