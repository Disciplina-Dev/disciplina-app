import { computeAge } from '../utils/age';
import { Candidate } from '../types/candidate.types';

const SCHOOL_LEVEL_LABELS: Record<string, string> = {
    CAP_BEP_WITH_1Y_EXP: 'CAP/BEP + 1 an exp.',
    PREMIERE_TERMINALE: '1ère / Terminale',
    PREMIERE_TERMINALE_WITH_1Y_EXP: '1ère / Term. + 1 an exp.',
    BAC: 'Bac',
    BAC_WITH_1Y_EXP: 'Bac + 1 an exp.',
    BAC_PLUS: 'Bac +1',
    BAC_PLUS_2: 'Bac +2',
    BAC_PLUS_2_PLUS: 'Bac +2 ou plus',
    BAC_PLUS_3_PLUS: 'Bac +3 ou plus',
};

function prettyEnum(v: string): string {
    return v
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildCandidateSummary(c: Candidate): string {
    const parts: string[] = [];

    const age = computeAge(c.identity.date_of_birth) ?? c.identity.age;
    const tps = (c.tp_types ?? []).join(', ');
    const profil = [c.identity.full_name, age != null ? `${age} ans` : null, c.identity.city || null]
        .filter(Boolean)
        .join(', ');
    const level = c.education?.school_level ? SCHOOL_LEVEL_LABELS[c.education.school_level] : null;
    let s1 = profil;
    if (tps) s1 += ` — vise ${tps}`;
    if (level) s1 += `, niveau ${level}`;
    if (s1.trim()) parts.push(s1 + '.');

    const dipl: string[] = [];
    if (c.background?.last_diploma) dipl.push(`dernier diplôme obtenu : ${c.background.last_diploma}`);
    if (c.background?.last_diploma_prepared) dipl.push(`préparé : ${c.background.last_diploma_prepared}`);
    if (dipl.length) parts.push(dipl.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.');

    const dispo: string[] = [];
    const mob = c.job_info?.geographic_mobility?.map(prettyEnum).join(', ');
    if (mob) dispo.push(`mobilité : ${mob}`);
    if (c.job_info?.availability_date) {
        dispo.push(`disponible le ${new Date(c.job_info.availability_date).toLocaleDateString('fr-FR')}`);
    }
    if (dispo.length) parts.push(dispo.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.');

    const atouts: string[] = [];
    if (c.profile?.qualities?.length) atouts.push(`points forts : ${c.profile.qualities.join(', ')}`);
    if (c.professional_projects?.career_objectives) {
        atouts.push(`objectif : ${c.professional_projects.career_objectives}`);
    }
    if (atouts.length) parts.push(atouts.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.');

    return parts.join(' ');
}
