import { env } from '../../config/env';
import { logger } from '../logger';

export class OllamaService {
    /**
     * Send a single chat turn to an Ollama model.
     * @param prompt - the user message content
     * @param role   - the system/persona instruction (system message content)
     * @param model  - the model name, e.g. 'qwen2.5:3b'
     * @returns the model's text reply, or '' on error/timeout.
     */
    async chat(prompt: string, role: string, model: string): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        try {
            const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: role },
                        { role: 'user', content: prompt },
                    ],
                    stream: false,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                logger.warn({ status: response.status }, 'Ollama API error');
                return '';
            }

            const data = (await response.json()) as { message?: { content?: string } };
            return data.message?.content ?? '';
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.warn({ error: errorMsg }, 'Ollama chat failed');
            return '';
        } finally {
            clearTimeout(timeout);
        }
    }
}
