import { Session } from '../../types/session.types';

export function sessionToGql(s: Session, alternantCount?: number): object {
    return {
        id: s._id,
        nom: s.nom,
        filiere: s.filiere ?? null,
        jourCours: s.jour_cours ?? null,
        dateDebut: s.date_debut ? new Date(s.date_debut).toISOString() : null,
        dateFin: s.date_fin ? new Date(s.date_fin).toISOString() : null,
        alternantCount: alternantCount ?? 0,
        createdAt: s.created_at ? new Date(s.created_at).toISOString() : null,
        updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : null,
    };
}
