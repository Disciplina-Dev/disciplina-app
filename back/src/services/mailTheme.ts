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

const MAX_WIDTH_PX = 600;

/**
 * Enveloppe le corps d'un mail pour l'envoi : toujours une largeur maximale centrée
 * (comme n'importe quelle newsletter — sans ça le HTML s'étale sur toute la largeur de la
 * boîte de réception et casse la mise en page), et en plus un cadre de la couleur choisie +
 * un fond pastel dérivé automatiquement de cette couleur si un thème est actif. `html` doit
 * déjà avoir été sanitisé (sanitizeMailHtml) — l'enveloppe elle-même est du HTML fixe côté
 * serveur, jamais dérivée d'une entrée utilisateur, donc pas besoin de la re-sanitiser.
 */
export function wrapWithTheme(html: string, themeColor: string | null | undefined): string {
    const inner =
        themeColor && isMailThemeColor(themeColor)
            ? `<div style="background-color:${themeColor};padding:24px;">` +
                `<div style="background-color:${pastelize(themeColor)};border-radius:8px;padding:24px;">` +
                html +
                '</div></div>'
            : html;
    return `<div style="max-width:${MAX_WIDTH_PX}px;margin:0 auto;">${inner}</div>`;
}
