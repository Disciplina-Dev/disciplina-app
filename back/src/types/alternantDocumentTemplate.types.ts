import { AlternantSequenceType } from './alternant.types';

/**
 * Modèle de document pour une SA (#888). J15/J10W : deux lignes système
 * permanentes (non supprimables, seedées au boot). PERIODIQUE : créables/
 * supprimables librement depuis la page Réglages, choisies par Session.
 */
export interface AlternantDocumentTemplate {
    _id: string;
    type: AlternantSequenceType;
    /** Libellé affiché (ex. "TP AD", "Téléphonique") — texte libre, pas un enum. */
    label: string;
    maitre_apprentissage: string;
    alternant: string;
    formateur: string;
    created_at: Date | string;
    updated_at: Date | string;
}
