/**
 * Types domaine Session (pédagogie). Comme `alternant.types.ts`, ces types
 * sont en snake_case et miroient le document Mongo — la conversion camelCase
 * se fait au resolver (cf. `services/mappers/session.mapper.ts`).
 */

/** Jour de cours hebdomadaire d'une session (sélection unique). */
export const JOURS_COURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

export type JourCours = (typeof JOURS_COURS)[number];

export interface Session {
    _id: string;
    nom: string;
    filiere?: string | null;
    jour_cours?: string | null;
    date_debut: Date | string;
    date_fin: Date | string;
    created_at: Date | string;
    updated_at: Date | string;
}
