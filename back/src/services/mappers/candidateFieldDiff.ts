import { Candidate, CandidateStatus, Identity } from '../../types/candidate.types';

const EXCLUDED_FIELDS = new Set<keyof Candidate>([
    '_id',
    'candidate_id',
    'pdf_link',
    'cv_link',
    'drive_folder_id',
    'drive_folder_link',
    'photo_link',
    'classmarker',
]);

const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
    [CandidateStatus.SEEKING]: 'Recherche',
    [CandidateStatus.NOT_SEEKING]: 'Ne recherche pas',
    [CandidateStatus.CANCELLED]: 'Rupture',
    [CandidateStatus.MATCHED]: 'Matché',
    [CandidateStatus.CONTRACT]: 'En contrat',
    [CandidateStatus.IMMERSING]: 'Immersion',
    [CandidateStatus.BANNED]: 'Banni',
};

const TOP_LEVEL_LABELS: Partial<Record<keyof Candidate, string>> = {
    status: 'Statut',
    tp_type: 'Type TP',
    training_site: 'Site de formation',
    immersion_agreement: "Accord d'immersion",
    desired_sectors: 'Secteurs souhaités',
    expected_company_skills: 'Compétences entreprise attendues',
    identity: 'Identité',
    education: 'Formation',
    support: 'Accompagnement',
    background: 'Parcours',
    profile: 'Profil',
    professional_projects: 'Projet professionnel',
    skills_assessment: 'Évaluation des compétences',
    job_info: 'Infos poste',
    synthesis: 'Synthèse',
};

const IDENTITY_LABELS: Partial<Record<keyof Identity, string>> = {
    full_name: 'Nom complet',
    email: 'Email',
    phone: 'Téléphone',
    address: 'Adresse',
    postal_code: 'Code postal',
    city: 'Ville',
    date_of_birth: 'Date de naissance',
    place_of_birth: 'Lieu de naissance',
    sex: 'Sexe',
    driving_license_b: 'Permis B',
    transport_means: 'Moyen de transport',
};

function formatValue(field: keyof Candidate, value: unknown): string {
    if (value == null) return '—';
    if (field === 'status') return CANDIDATE_STATUS_LABELS[value as CandidateStatus];
    if (value instanceof Date) return value.toLocaleDateString('fr-FR');
    if (typeof value === 'object') {
        const json = JSON.stringify(value);
        return json.length > 80 ? `${json.slice(0, 80)}…` : json;
    }
    return String(value);
}

function buildEntry(label: string, before: unknown, after: unknown, field: keyof Candidate): { description: string } {
    return {
        description: `Le champ ${label} est passé de ${formatValue(field, before)} à ${formatValue(field, after)}`,
    };
}

function buildIdentityDiff(previous: Identity, next: Identity): { description: string }[] {
    const entries: { description: string }[] = [];
    for (const key of Object.keys(next) as (keyof Identity)[]) {
        const label = IDENTITY_LABELS[key];
        if (!label) continue;
        if (previous[key] === next[key]) continue;
        entries.push(buildEntry(label, previous[key], next[key], 'identity'));
    }
    return entries;
}

export function buildFieldChangeEntries(previous: Candidate, data: Partial<Candidate>): { description: string }[] {
    const entries: { description: string }[] = [];
    for (const key of Object.keys(data) as (keyof Candidate)[]) {
        if (EXCLUDED_FIELDS.has(key)) continue;
        const label = TOP_LEVEL_LABELS[key];
        if (!label) continue;

        if (key === 'identity' && data.identity) {
            entries.push(...buildIdentityDiff(previous.identity, data.identity));
            continue;
        }

        if (previous[key] === data[key]) continue;
        entries.push(buildEntry(label, previous[key], data[key], key));
    }
    return entries;
}
