import { MailThemeId } from '../types/mailTemplate.types';

interface MailTheme {
    id: MailThemeId;
    label: string;
    /** Couleur du cadre extérieur ; `null` pour "classique" (pas de cadre, fond blanc). */
    frameColor: string | null;
    /** Fond derrière le texte — toujours une nuance pâle de `frameColor` pour rester lisible. */
    contentBg: string;
}

// Couleurs reprises des tokens de marque (front/.../index.css) et des pastels déjà
// utilisés pour le surlignage dans l'éditeur (cf. #747) — pas de nouvelle palette.
export const MAIL_THEMES: MailTheme[] = [
    { id: 'classique', label: 'Classique', frameColor: null, contentBg: '#ffffff' },
    { id: 'bleu', label: 'Bleu Disciplina', frameColor: '#1130A7', contentBg: '#E8EBFA' },
    { id: 'chaleureux', label: 'Chaleureux', frameColor: '#A65C00', contentBg: '#FEF3E2' },
    { id: 'nature', label: 'Nature', frameColor: '#1A7A4A', contentBg: '#E6F4ED' },
    { id: 'elegant', label: 'Élégant', frameColor: '#60207E', contentBg: '#F0E6F6' },
];

const THEMES_BY_ID = new Map(MAIL_THEMES.map((t) => [t.id, t]));

/**
 * Enveloppe le corps d'un mail dans le cadre + fond du thème choisi. `html` doit déjà
 * avoir été sanitisé (sanitizeMailHtml) — l'enveloppe elle-même est du HTML fixe côté
 * serveur, jamais dérivée d'une entrée utilisateur, donc pas besoin de la re-sanitiser.
 */
export function wrapWithTheme(html: string, themeId: MailThemeId | null | undefined): string {
    const theme = themeId ? THEMES_BY_ID.get(themeId) : undefined;
    if (!theme || !theme.frameColor) return html;
    return (
        `<div style="background-color:${theme.frameColor};padding:24px;">` +
        `<div style="background-color:${theme.contentBg};border-radius:8px;padding:24px;">` +
        html +
        '</div></div>'
    );
}
