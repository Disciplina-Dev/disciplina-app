/**
 * Calculs d'horaires d'une séance d'émargement, extraits du service pour être
 * partagés avec le référentiel des formateurs (statistiques d'heures) sans
 * créer de cycle d'imports. Toutes les fonctions sont pures.
 */
import {
    EMARGEMENT_HALVES,
    EmargementHalf,
    EmargementRecord,
    Seance,
    SeanceValidation,
    SeanceValidationStatus,
} from '../types/emargement.types';
import { minutesOfDay, windowState, zonedDateTimeToUtc } from '../utils/zonedTime';

/** Demi-journées à valider : l'après-midi n'existe que s'il a un créneau. */
export function applicableHalves(seance: Seance): EmargementHalf[] {
    return seance.afternoon_start ? [...EMARGEMENT_HALVES] : ['morning'];
}

/** Bornes horaires d'une demi-journée (`null` si la séance n'a pas ce créneau). */
export function halfBounds(seance: Seance, half: EmargementHalf): { start: string; end: string } | null {
    const start = half === 'morning' ? seance.morning_start : seance.afternoon_start;
    const end = half === 'morning' ? seance.morning_end : seance.afternoon_end;
    return start && end ? { start, end } : null;
}

/**
 * Horaires de cours d'une demi-journée, qui servent au calcul des heures.
 * Les séances créées avant le lot 8 n'ont pas ces champs : on retombe alors sur
 * le créneau de signature, ce qui reproduit exactement les heures d'avant.
 */
export function classSchedule(seance: Seance, half: EmargementHalf): { start: string; end: string } | null {
    const start = half === 'morning' ? seance.morning_class_start : seance.afternoon_class_start;
    const end = half === 'morning' ? seance.morning_class_end : seance.afternoon_class_end;
    if (start && end) return { start, end };
    return halfBounds(seance, half);
}

/** Heures prévues d'une demi-journée : la durée des horaires de cours. */
export function plannedMinutesOf(seance: Seance, half: EmargementHalf): number {
    const bounds = classSchedule(seance, half);
    if (!bounds) return 0;
    return Math.max(0, minutesOfDay(bounds.end) - minutesOfDay(bounds.start));
}

/** Heures de cours planifiées de la séance entière (pause déjeuner exclue). */
export function plannedMinutesOfSeance(seance: Seance): number {
    return applicableHalves(seance).reduce((total, half) => total + plannedMinutesOf(seance, half), 0);
}

/**
 * Heures réalisées d'une demi-journée :
 * - `present` → tous les horaires de cours ;
 * - `late` → de l'heure d'arrivée à la fin des cours ;
 * - `left_early` → du début des cours à l'heure de départ ;
 * - `absent` / `na` → 0.
 *
 * Sans heure saisie, une arrivée tardive ou un départ anticipé comptent la
 * demi-journée entière : mieux vaut surestimer la présence que de la nier.
 */
export function attendedMinutesOf(seance: Seance, half: EmargementHalf, record: EmargementRecord | null): number {
    const planned = plannedMinutesOf(seance, half);
    if (!record || planned === 0) return 0;
    const bounds = classSchedule(seance, half)!;
    if (record.status === 'present') return planned;
    if (record.status === 'late' && record.status_time) {
        return Math.max(0, Math.min(planned, minutesOfDay(bounds.end) - minutesOfDay(record.status_time)));
    }
    if (record.status === 'left_early' && record.status_time) {
        return Math.max(0, Math.min(planned, minutesOfDay(record.status_time) - minutesOfDay(bounds.start)));
    }
    return 0;
}

/**
 * Validations stockées, avec repli sur l'ancien champ `signed_at` : les feuilles
 * signées avant le lot 4 n'ont qu'une signature globale, qui valait pour toutes
 * les demi-journées du jour. Aucune migration de données n'est nécessaire.
 */
export function validationsOf(seance: Seance): {
    morning: SeanceValidation | null;
    afternoon: SeanceValidation | null;
} {
    const stored = seance.validations ?? { morning: null, afternoon: null };
    if (stored.morning || stored.afternoon) {
        return { morning: stored.morning ?? null, afternoon: stored.afternoon ?? null };
    }
    if (!seance.signed_at) return { morning: null, afternoon: null };
    const legacy: SeanceValidation = {
        signed_at: seance.signed_at,
        signed_by_name: seance.signed_by_name ?? seance.formateur_name,
        source: 'formateur',
        signature_image: seance.signature_image ?? null,
        signed_ip: seance.signed_ip ?? null,
        signed_user_agent: seance.signed_user_agent ?? null,
    };
    return { morning: legacy, afternoon: seance.afternoon_start ? legacy : null };
}

/** Fenêtre de signature d'une demi-journée dans le fuseau de la séance. */
export function halfWindowOf(seance: Seance, half: EmargementHalf): { start: Date; end: Date } | null {
    const start = half === 'morning' ? seance.morning_start : seance.afternoon_start;
    const end = half === 'morning' ? seance.morning_end : seance.afternoon_end;
    if (!start || !end) return null;
    return {
        start: zonedDateTimeToUtc(seance.date, start, seance.timezone),
        end: zonedDateTimeToUtc(seance.date, end, seance.timezone),
    };
}

/** État affiché dans les listes : en cours, à valider, anomalie, validée. */
export function seanceValidationStatus(seance: Seance, now: Date): SeanceValidationStatus {
    const halves = applicableHalves(seance);
    const validations = validationsOf(seance);
    if (halves.every((half) => validations[half])) return 'validated';
    const allClosed = halves.every((half) => {
        const window = halfWindowOf(seance, half);
        return window ? windowState(now, window.start, window.end) === 'closed' : true;
    });
    if (!allClosed) return 'in_progress';
    // Tous les créneaux sont fermés mais une demi-journée reste non signée :
    // tant que le lien court (J+7), le formateur peut encore la signer.
    return new Date(seance.invite_expires_at).getTime() < now.getTime() ? 'anomaly' : 'to_validate';
}
