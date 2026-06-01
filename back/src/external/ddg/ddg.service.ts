import { search as ddgSearch, SafeSearchType } from 'duck-duck-scrape';
import { logger } from '../logger';
import { DdgResult } from './types';

export class DdgService {
    async search(query: string): Promise<DdgResult[]> {
        try {
            const searchResults = await ddgSearch(query, { safeSearch: SafeSearchType.MODERATE });
            return searchResults.results.map((result: any) => ({
                title: result.title,
                url: result.url,
                description: result.description || '',
            }));
        } catch (error) {
            logger.error({ error }, 'DDG search failed');
            throw new Error(`Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
