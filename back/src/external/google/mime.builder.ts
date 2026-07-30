import { SendEmailOptions } from './types';

/**
 * Un CR/LF dans une valeur de header permettrait d'injecter des headers
 * arbitraires (Bcc, Content-Type…). Les valeurs viennent de sources éditables
 * (modèles de mail, Google Sheet), donc on les neutralise systématiquement.
 */
function sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeSubject(subject: string): string {
    const safe = sanitizeHeaderValue(subject);
    if (!/[^ -~]/.test(safe)) return safe;
    return `=?UTF-8?B?${Buffer.from(safe).toString('base64')}?=`;
}

interface InlineImage {
    cid: string;
    contentType: string;
    content: string; // base64
}

/**
 * Extrait les images `data:` inline du HTML et les remplace par des références `cid:`.
 * Gmail (et la plupart des webmails) ne rendent pas les `<img src="data:…base64">` ;
 * il faut les envoyer comme parties MIME inline référencées par Content-ID.
 */
function extractInlineImages(html: string): { html: string; images: InlineImage[] } {
    const images: InlineImage[] = [];
    let i = 0;
    const out = html.replace(
        /src=(["'])data:([^;]+);base64,([^"']+)\1/g,
        (_m, _q, contentType: string, content: string) => {
            const cid = `img${i++}@disciplina`;
            images.push({ cid, contentType, content });
            return `src="cid:${cid}"`;
        },
    );
    return { html: out, images };
}

function htmlPart(html: string): string {
    return ['Content-Type: text/html; charset=utf-8', '', html].join('\r\n');
}

function textPart(text: string): string {
    return ['Content-Type: text/plain; charset=utf-8', '', text].join('\r\n');
}

/**
 * Corps du message : HTML seul si aucun texte fourni, sinon `multipart/alternative`
 * (texte + HTML). Un mail HTML-only sans alternative text/plain est un signal spam
 * fort (Gmail notamment) ; on émet toujours les deux quand le texte est disponible.
 */
function bodyBlock(html: string, text?: string): string {
    if (!text) return htmlPart(html);
    const alt = '==Disciplina-alt==';
    return [
        `Content-Type: multipart/alternative; boundary="${alt}"`,
        '',
        `--${alt}`,
        textPart(text),
        '',
        `--${alt}`,
        htmlPart(html),
        '',
        `--${alt}--`,
    ].join('\r\n');
}

function inlineImagePart(img: InlineImage, boundary: string): string {
    return [
        `--${boundary}`,
        `Content-Type: ${img.contentType}`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: inline; filename="${img.cid}"`,
        `Content-ID: <${img.cid}>`,
        '',
        img.content,
        '',
    ].join('\r\n');
}

function attachmentPart(
    attachment: { filename: string; content: string; contentType?: string },
    boundary: string,
): string {
    return [
        `--${boundary}`,
        `Content-Type: ${attachment.contentType || 'application/octet-stream'}`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        attachment.content,
        '',
    ].join('\r\n');
}

export function buildRawMessage(options: SendEmailOptions): string {
    const { html, images } = extractInlineImages(options.html);
    const attachments = (options.attachments ?? []).filter((a) => a.content && a.filename);
    const subject = encodeSubject(options.subject);
    const text = options.text?.trim() ? options.text : undefined;
    const headers = ['MIME-Version: 1.0', `To: ${sanitizeHeaderValue(options.to)}`, `Subject: ${subject}`];

    // En-tête de désabonnement (Gmail bulk sender rules) : réduit le marquage spam et
    // offre le lien natif « Se désabonner ». Fourni uniquement pour les envois en nombre.
    if (options.listUnsubscribe) {
        headers.push(`List-Unsubscribe: ${sanitizeHeaderValue(options.listUnsubscribe)}`);
    }

    let message: string;

    if (images.length === 0 && attachments.length === 0) {
        // HTML simple (ou multipart/alternative si texte fourni).
        message = [...headers, bodyBlock(html, text)].join('\r\n');
    } else if (images.length > 0 && attachments.length === 0) {
        // HTML + images inline → multipart/related.
        const rel = '==Disciplina-rel==';
        message = [
            ...headers,
            `Content-Type: multipart/related; boundary="${rel}"`,
            '',
            `--${rel}`,
            bodyBlock(html, text),
            '',
            ...images.map((img) => inlineImagePart(img, rel)),
            `--${rel}--`,
        ].join('\r\n');
    } else if (images.length === 0) {
        // HTML + pièces jointes → multipart/mixed.
        const mix = '==Disciplina-mix==';
        message = [
            ...headers,
            `Content-Type: multipart/mixed; boundary="${mix}"`,
            '',
            `--${mix}`,
            bodyBlock(html, text),
            '',
            ...attachments.map((a) => attachmentPart(a, mix)),
            `--${mix}--`,
        ].join('\r\n');
    } else {
        // HTML + images inline + pièces jointes → mixed { related { html, inline }, attachments }.
        const mix = '==Disciplina-mix==';
        const rel = '==Disciplina-rel==';
        message = [
            ...headers,
            `Content-Type: multipart/mixed; boundary="${mix}"`,
            '',
            `--${mix}`,
            `Content-Type: multipart/related; boundary="${rel}"`,
            '',
            `--${rel}`,
            bodyBlock(html, text),
            '',
            ...images.map((img) => inlineImagePart(img, rel)),
            `--${rel}--`,
            '',
            ...attachments.map((a) => attachmentPart(a, mix)),
            `--${mix}--`,
        ].join('\r\n');
    }

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
