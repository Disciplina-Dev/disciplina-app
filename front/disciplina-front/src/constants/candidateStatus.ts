import { CandidateStatus } from '@/types/candidate';

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
    [CandidateStatus.SEEKING]: 'Recherche',
    [CandidateStatus.NOT_SEEKING]: 'Ne recherche pas',
    [CandidateStatus.UNAVAILABLE]: 'Indisponible',
    [CandidateStatus.CANCELLED]: 'Rupture',
    [CandidateStatus.CONTRACT]: 'En contrat',
    [CandidateStatus.IMMERSING]: 'Immersion',
    [CandidateStatus.BANNED]: 'Banni',
};

export const CANDIDATE_STATUS_BADGE_CLASS: Record<CandidateStatus, string> = {
    [CandidateStatus.SEEKING]: 'bg-blue text-white',
    [CandidateStatus.NOT_SEEKING]: 'bg-gray-400 text-white',
    [CandidateStatus.UNAVAILABLE]: 'bg-warning text-white',
    [CandidateStatus.CANCELLED]: 'bg-warning text-white',
    [CandidateStatus.CONTRACT]: 'bg-success text-white',
    [CandidateStatus.IMMERSING]: 'bg-cyan-500 text-white',
    [CandidateStatus.BANNED]: 'bg-danger text-white',
};

export const CANDIDATE_STATUS_CHART_COLOR: Record<CandidateStatus, string> = {
    [CandidateStatus.SEEKING]: '#3b82f6',     // blue
    [CandidateStatus.NOT_SEEKING]: '#9ca3af',  // gray-400
    [CandidateStatus.UNAVAILABLE]: '#d97706',  // amber-600 (indisponible)
    [CandidateStatus.CANCELLED]: '#f59e0b',    // warning (amber)
    [CandidateStatus.CONTRACT]: '#10b981',     // success (emerald)
    [CandidateStatus.IMMERSING]: '#06b6d4',    // info (cyan)
    [CandidateStatus.BANNED]: '#ef4444',       // danger (red)
};

export const CANDIDATE_STATUS_ORDER: CandidateStatus[] = [
    CandidateStatus.SEEKING,
    CandidateStatus.IMMERSING,
    CandidateStatus.CONTRACT,
    CandidateStatus.UNAVAILABLE,
    CandidateStatus.CANCELLED,
    CandidateStatus.NOT_SEEKING,
    CandidateStatus.BANNED,
];
