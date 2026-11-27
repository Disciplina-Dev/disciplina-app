import sanitizeHtml from 'sanitize-html';

// Autorise juste assez de mise en forme pour des mails "plus jolis" (couleur de texte,
// image inline en base64, bouton CTA stylé) sans ouvrir la porte à du HTML/CSS arbitraire.
const HEX_OR_NAMED_COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]+)$/i;
// Une à quatre valeurs (ex. `10px 20px` pour le padding du bouton CTA) — la forme
// raccourcie standard des propriétés CSS box-model (haut/droite/bas/gauche).
const LENGTH_VALUE = /^\d{1,4}(px|%)(\s+\d{1,4}(px|%)){0,3}$/;
// `width`/`height` seuls : en plus d'une longueur, `auto` (ex. une image en largeur 100%
// dont la hauteur doit rester proportionnelle, pas étirée).
const LENGTH_OR_AUTO_VALUE = /^(auto|\d{1,4}(px|%))$/;
const KEYWORD_VALUE = /^[a-z-]+$/i;

const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'span', 'a', 'b', 'i', 'em', 'strong', 'u', 'h2', 'h3', 'img', 'hr'],
    allowedAttributes: {
        a: ['href', 'target', 'rel', 'style'],
        img: ['src', 'alt', 'width', 'height', 'style'],
        span: ['style'],
        p: ['style'],
        // `align` : attribut HTML historique (pas du CSS) toujours respecté nativement par
        // <hr> — nécessaire car Gmail (entre autres) supprime `margin` en style inline sur
        // ce tag, même autorisé ; sert de filet pour l'alignement gauche/centré/droite.
        hr: ['style', 'align'],
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
            // `border:none` : supprime la bordure native du <hr>, sinon elle se superpose
            // au fond coloré utilisé pour dessiner la barre de séparation personnalisée.
            border: [KEYWORD_VALUE],
            width: [LENGTH_OR_AUTO_VALUE],
            height: [LENGTH_OR_AUTO_VALUE],
            // Alignement gauche/centré/droite de la barre de séparation : seul le côté "auto"
            // est envoyé (l'autre est omis, 0 par défaut navigateur) - la regex n'accepte de
            // toute façon pas un `0` nu, seulement `auto` ou une longueur avec unité.
            'margin-left': [LENGTH_OR_AUTO_VALUE],
            'margin-right': [LENGTH_OR_AUTO_VALUE],
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

// Entités que sanitize-html émet lui-même en ré-encodant le HTML nettoyé.
const TEXT_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};

/**
 * Version texte d'un mail déjà passé par `sanitizeMailHtml`, pour la partie
 * `text/plain` (multipart/alternative). Les entités doivent être décodées : sans ça
 * une URL contenant `&` (ex. lien signé `?…&sig=…&ts=…`) arrive en clair avec
 * `&amp;` et ne fonctionne pas si le candidat la copie depuis sa messagerie.
 * Les sauts de ligne et fins de bloc sont conservés pour que les liens répétés en
 * clair restent lisibles/copiables dans les clients sans HTML.
 */
export function htmlToPlainText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|ul|ol|h2|h3|hr)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => TEXT_ENTITIES[entity])
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
