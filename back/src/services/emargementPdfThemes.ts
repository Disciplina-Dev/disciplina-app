/**
 * Gabarits d'impression des documents d'émargement (#955, §8.4).
 *
 * Le contenu des documents (feuille de séance, attestation d'assiduité) est le
 * même ; seule la charte change : couleur d'accent, bandeau et mentions légales
 * de pied de page. Trois gabarits sont exposés au Peda :
 * - `disciplina` : charte interne (défaut) ;
 * - `region` : action cofinancée par la Région Réunion ;
 * - `fse` : cofinancement Union européenne — FSE+.
 *
 * Les gabarits sont des constantes, pas des données en base : un modèle
 * « paramétrable » au sens du cahier des charges (choix de la charte au moment
 * de l'export), sans écran d'administration à maintenir.
 */

export const EMARGEMENT_PDF_THEMES = ['disciplina', 'region', 'fse'] as const;
export type EmargementPdfTheme = (typeof EMARGEMENT_PDF_THEMES)[number];

export const EMARGEMENT_PDF_THEME_LABELS: Record<EmargementPdfTheme, string> = {
    disciplina: 'Disciplina',
    region: 'Région Réunion',
    fse: 'FSE+',
};

export interface EmargementPdfThemeSpec {
    /** Couleur d'accent (titres, filets, en-têtes de tableau). */
    accent: string;
    /** Fond très clair des blocs d'en-tête. */
    soft: string;
    /** Libellé affiché en haut à droite du document. */
    brandLabel: string;
    /** Bandeau de cofinancement affiché sous le titre (facultatif). */
    band: string | null;
    /** Mentions de pied de page, une ligne par entrée. */
    footerLines: string[];
}

const LEGAL_LINES = [
    'DISCIPLINA | 71 rue Roger Payet, Sainte-Marie 97438 | Numéro SIRET : 97828986600011',
    "Déclaration d'activité enregistrée sous le n° 04973484197 auprès du Préfet de région de Réunion. Cet enregistrement ne vaut pas agrément de l'État.",
];

export const EMARGEMENT_PDF_THEME_SPECS: Record<EmargementPdfTheme, EmargementPdfThemeSpec> = {
    disciplina: {
        accent: '#1130A7',
        soft: '#EEF2FF',
        brandLabel: 'DISCIPLINA',
        band: null,
        footerLines: LEGAL_LINES,
    },
    region: {
        accent: '#00594F',
        soft: '#E8F5F0',
        brandLabel: 'RÉGION RÉUNION',
        band: 'Action cofinancée par la Région Réunion.',
        footerLines: [
            ...LEGAL_LINES,
            'Action cofinancée par la Région Réunion dans le cadre du programme régional de formation.',
        ],
    },
    fse: {
        accent: '#003399',
        soft: '#E9EEF9',
        brandLabel: 'FSE+',
        band: 'Cofinancé par l’Union européenne — Fonds social européen Plus (FSE+). L’Europe s’engage à La Réunion.',
        footerLines: [...LEGAL_LINES, 'Cofinancé par l’Union européenne — Fonds social européen Plus (FSE+).'],
    },
};

/** Valide un thème reçu en paramètre de requête (défaut : charte Disciplina). */
export function parsePdfTheme(value: unknown): EmargementPdfTheme {
    return typeof value === 'string' && (EMARGEMENT_PDF_THEMES as readonly string[]).includes(value)
        ? (value as EmargementPdfTheme)
        : 'disciplina';
}
