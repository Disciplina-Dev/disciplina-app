export enum MatchedCandidateStatus {
    PRE_SELECTED = 'PRE_SELECTED',
    PRE_SELECTED_MAIL_SEND = 'PRE_SELECTED_MAIL_SEND',
    DECLINED = 'DECLINED',
    ACCEPTED = 'ACCEPTED',
    SEND = 'SEND',
    REFUSED = 'REFUSED',
    INTERVIEW = 'INTERVIEW',
    IMMERSING = 'IMMERSING',
}

export const MATCHED_CANDIDATE_STATUS_LABELS: Record<MatchedCandidateStatus, string> = {
    [MatchedCandidateStatus.PRE_SELECTED]: 'Candidat pré-sélectionné',
    [MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND]: 'Candidat pré-sélectionné et mail envoyé',
    [MatchedCandidateStatus.DECLINED]: 'Offre déclinée',
    [MatchedCandidateStatus.ACCEPTED]: 'Candidat accepté',
    [MatchedCandidateStatus.SEND]: 'Candidat déjà envoyé',
    [MatchedCandidateStatus.REFUSED]: 'Refusé',
    [MatchedCandidateStatus.INTERVIEW]: 'Entretien',
    [MatchedCandidateStatus.IMMERSING]: 'Immersion',
};

export const MATCHED_CANDIDATE_STATUS_BADGE_CLASS: Record<MatchedCandidateStatus, string> = {
    [MatchedCandidateStatus.PRE_SELECTED]: 'bg-blue text-white',
    [MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND]: 'bg-blue text-white',
    [MatchedCandidateStatus.DECLINED]: 'bg-danger text-white',
    [MatchedCandidateStatus.ACCEPTED]: 'bg-success text-white',
    [MatchedCandidateStatus.SEND]: 'bg-purple text-white',
    [MatchedCandidateStatus.REFUSED]: 'bg-danger text-white',
    [MatchedCandidateStatus.INTERVIEW]: 'bg-purple text-white',
    [MatchedCandidateStatus.IMMERSING]: 'bg-purple text-white',
};

export const MATCHED_CANDIDATE_STATUS_ORDER: MatchedCandidateStatus[] = [
    MatchedCandidateStatus.PRE_SELECTED,
    MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND,
    MatchedCandidateStatus.DECLINED,
    MatchedCandidateStatus.ACCEPTED,
    MatchedCandidateStatus.SEND,
    MatchedCandidateStatus.REFUSED,
    MatchedCandidateStatus.INTERVIEW,
    MatchedCandidateStatus.IMMERSING,
];
