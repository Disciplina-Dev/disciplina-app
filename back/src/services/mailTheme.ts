import { isMailThemeColor } from '../types/mailTemplate.types';

const PASTEL_WHITE_MIX = 0.85;

function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Éclaircit une couleur vers le blanc pour obtenir un fond pastel lisible derrière du texte. */
function pastelize(hex: string): string {
    const [r, g, b] = hexToRgb(hex);
    const mix = (c: number) => Math.round(c + (255 - c) * PASTEL_WHITE_MIX);
    return rgbToHex([mix(r), mix(g), mix(b)]);
}

/**
 * Enveloppe le corps d'un mail dans un cadre de la couleur choisie + un fond pastel dérivé
 * automatiquement de cette couleur. `html` doit déjà avoir été sanitisé (sanitizeMailHtml) —
 * l'enveloppe elle-même est du HTML fixe côté serveur, jamais dérivée d'une entrée utilisateur,
 * donc pas besoin de la re-sanitiser.
 */
export function wrapWithTheme(html: string, themeColor: string | null | undefined): string {
    if (!themeColor || !isMailThemeColor(themeColor)) return html;
    const contentBg = pastelize(themeColor);
    return (
        `<div style="background-color:${themeColor};padding:24px;">` +
        `<div style="background-color:${contentBg};border-radius:8px;padding:24px;">` +
        html +
        '</div></div>'
    );
}
