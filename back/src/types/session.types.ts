/**
 * Types domaine Session (pédagogie). Comme `alternant.types.ts`, ces types
 * sont en snake_case et miroient le document Mongo — la conversion camelCase
 * se fait au resolver (cf. `services/mappers/session.mapper.ts`).
 */

/** Jour de cours hebdomadaire d'une session (sélection unique). */
export const JOURS_COURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

export type JourCours = (typeof JOURS_COURS)[number];

export interface SessionPerson {
    first_name: string;
    last_name: string;
    mail_address: string;
}

export interface SessionAddress {
    housenumber: string;
    street: string;
    complement: string;
    city: string;
    postcode: string;
    country: string;
    formatted: string;
}

export interface Session {
    _id: string;
    nom: string;
    filiere?: string | null;
    jour_cours?: string | null;
    date_debut: Date | string;
    date_fin: Date | string;
    head_teacher?: SessionPerson | null;
    referent_teacher?: SessionPerson | null;
    realization_address?: SessionAddress | null;
    created_at: Date | string;
    updated_at: Date | string;
}

/** Entrée de création d'une promotion Filiz (camelCase, comme les autres inputs de service). */
export interface CreateSessionInput {
    degreeId: string;
    nom: string;
    dateDebut: string;
    dateFin: string;
    subjectValidation: boolean;
    generalEducationDuration?: string | null;
    headTeacher?: { firstName: string; lastName: string; mailAddress: string } | null;
    referentTeacher?: { firstName: string; lastName: string; mailAddress: string } | null;
    realizationAddress?: Partial<
        Record<'street' | 'complement' | 'city' | 'postcode' | 'country', string | null>
    > | null;
}
