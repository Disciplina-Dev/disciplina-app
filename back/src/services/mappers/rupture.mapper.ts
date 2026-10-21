import { Alternant } from '../../types/alternant.types';
import { Rupture } from '../../types/rupture.types';

export function ruptureToGql(r: Rupture, alternant: Alternant | null): object {
    const fullName = alternant ? `${alternant.first_name} ${alternant.last_name}`.trim() : '';
    return {
        id: r._id,
        alternantId: r.alternant_id,
        firstName: alternant?.first_name ?? null,
        lastName: alternant?.last_name ?? null,
        fullName,
        session: alternant?.session ?? '',
        sessionId: alternant?.session_id ?? null,
        dateRupture: r.date_rupture ? new Date(r.date_rupture).toISOString() : null,
        entreprise: r.entreprise ?? null,
        motif: r.motif,
        detail: r.detail ?? null,
        poursuitFormation: r.poursuit_formation,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
}
