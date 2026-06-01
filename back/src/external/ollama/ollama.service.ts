import { env } from '../../config/env';
import { logger } from '../logger';
import { ContactInfo } from './types';
import { ScrapedPage } from '../scraper/types';

export class OllamaService {
    async extractContacts(pages: ScrapedPage[]): Promise<ContactInfo[]> {
        if (pages.length === 0) {
            return [];
        }

        const cleanedHtml = pages
            .map((page) => {
                let html = page.html;
                html = html.replace(/<script[^>]*>.*?<\/script>/gs, '');
                html = html.replace(/<style[^>]*>.*?<\/style>/gs, '');
                return html.substring(0, 3000);
            })
            .join('\n\n');

        const prompt = `You are an assistant that extracts contact information from HTML content.
Extract all contact details: phone numbers, email addresses, names of legal representatives, addresses, fax numbers, LinkedIn URLs, etc.
Return ONLY a valid JSON array of objects with "name" and "value" fields. No explanation, no markdown, just the JSON array.
Example: [{"name":"Téléphone","value":"0262 12 34 56"},{"name":"Email","value":"contact@example.com"}]
If no contact info is found, return an empty array: []

HTML content:
${cleanedHtml}`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5:3b',
                    prompt,
                    stream: false,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                logger.warn({ status: response.status }, 'Ollama API error');
                return [];
            }

            const data = (await response.json()) as { response: string };
            const responseText = data.response || '';

            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                logger.warn('No JSON array found in Ollama response');
                return [];
            }

            const contacts = JSON.parse(jsonMatch[0]) as ContactInfo[];
            return Array.isArray(contacts) ? contacts : [];
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error: errorMsg }, 'Ollama extraction failed');
            return [];
        }
    }
}
