import sanitizeHtml from 'sanitize-html';

// Autorise juste assez de mise en forme pour des mails "plus jolis" (couleur de texte,
// image inline en base64, bouton CTA stylé) sans ouvrir la porte à du HTML/CSS arbitraire.
const HEX_OR_NAMED_COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]+)$/i;
const LENGTH_VALUE = /^\d{1,4}(px|%)$/;
const KEYWORD_VALUE = /^[a-z-]+$/i;

const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'span', 'a', 'b', 'i', 'em', 'strong', 'u', 'h2', 'h3', 'img'],
    allowedAttributes: {
        a: ['href', 'target', 'rel', 'style'],
        img: ['src', 'alt', 'width', 'height', 'style'],
        span: ['style'],
        p: ['style'],
    },
    allowedStyles: {
        '*': {
            color: [HEX_OR_NAMED_COLOR],
            'background-color': [HEX_OR_NAMED_COLOR],
            'text-align': [KEYWORD_VALUE],
            'font-size': [LENGTH_VALUE],
            padding: [LENGTH_VALUE],
            'border-radius': [LENGTH_VALUE],
            'font-weight': [KEYWORD_VALUE, /^\d{3}$/],
            'text-decoration': [KEYWORD_VALUE],
            // inline-block : nécessaire pour que le padding vertical du bouton CTA
            // s'applique réellement (un <a> reste inline sinon).
            display: [KEYWORD_VALUE],
            width: [LENGTH_VALUE],
            height: [LENGTH_VALUE],
        },
    },
    // `data:` reste nécessaire pour les images inline (mime.builder.ts les convertit en
    // pièces `cid:` avant l'envoi) ; volontairement absent des schémas autorisés pour `a href`.
    allowedSchemesByTag: { img: ['data', 'http', 'https'] },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }, true),
    },
};

export function sanitizeMailHtml(html: string): string {
    return sanitizeHtml(html, OPTIONS);
}
