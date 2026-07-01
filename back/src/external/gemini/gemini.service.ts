import { env } from '../../config/env';
import { logger } from '../logger';

/** Un fichier à envoyer à Gemini pour analyse multimodale. */
export interface GeminiInlineFile {
    name: string;
    mimeType: string;
    buffer: Buffer;
}

/** Types MIME que Gemini sait ingérer en `inline_data`. Les autres sont ignorés. */
const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif',
    'text/plain',
]);

/** Taille totale max des pièces jointes envoyées en inline (~18 Mo, marge sous la limite requête). */
const MAX_TOTAL_INLINE_BYTES = 18 * 1024 * 1024;

const SUMMARY_SYSTEM_PROMPT =
    "Tu es un assistant RH. À partir des documents du dossier d'un candidat en apprentissage " +
    '(CV, analyse de besoin, tests, notes), rédige un résumé synthétique de 2 à 3 phrases en français. ' +
    'Va à l\'essentiel : profil, projet professionnel, points forts. ' +
    'Ne mentionne pas les documents eux-mêmes. Réponds uniquement par le résumé, sans préambule.';

interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
}

export class GeminiService {
    /**
     * Résume le dossier d'un candidat à partir de ses documents Drive.
     * @returns le texte du résumé, ou '' si aucune clé, aucun fichier exploitable, ou erreur.
     */
    async summarizeCandidate(candidateName: string, files: GeminiInlineFile[]): Promise<string> {
        if (!env.GEMINI_API_KEY) {
            logger.warn('GEMINI_API_KEY manquante — résumé candidat désactivé');
            return '';
        }

        const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
            { text: `Candidat : ${candidateName}\n\nDocuments du dossier :` },
        ];

        let totalBytes = 0;
        for (const file of files) {
            const mime = file.mimeType.split(';')[0].trim().toLowerCase();
            if (!SUPPORTED_MIME_TYPES.has(mime)) continue;
            if (totalBytes + file.buffer.length > MAX_TOTAL_INLINE_BYTES) break;
            totalBytes += file.buffer.length;
            parts.push({ inline_data: { mime_type: mime, data: file.buffer.toString('base64') } });
        }

        if (parts.length === 1) {
            logger.warn({ candidateName }, 'Aucun document exploitable pour le résumé Gemini');
            return '';
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        try {
            const url = `${env.GEMINI_BASE_URL}/models/${env.GEMINI_MODEL}:generateContent`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SUMMARY_SYSTEM_PROMPT }] },
                    contents: [{ role: 'user', parts }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                logger.warn({ status: response.status, body: body.slice(0, 500) }, 'Gemini API error');
                return '';
            }

            const data = (await response.json()) as GeminiResponse;
            if (data.promptFeedback?.blockReason) {
                logger.warn({ reason: data.promptFeedback.blockReason }, 'Gemini a bloqué la requête');
                return '';
            }
            const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            return text.trim();
        } catch (error) {
            logger.warn({ err: error }, 'Gemini summarizeCandidate failed');
            return '';
        } finally {
            clearTimeout(timeout);
        }
    }
}

export const geminiService = new GeminiService();
