export enum MatchedCandidateStatus {
    RETAINED = 'RETAINED',
    OFFER_SEND = 'OFFER_SEND',
    ACCEPTED = 'ACCEPTED',
    DECLINED = 'DECLINED',
}

export const MATCHED_CANDIDATE_STATUS_LABELS: Record<MatchedCandidateStatus, string> = {
    [MatchedCandidateStatus.RETAINED]: 'Retenu',
    [MatchedCandidateStatus.OFFER_SEND]: 'Offre envoyée',
    [MatchedCandidateStatus.ACCEPTED]: 'Accepté',
    [MatchedCandidateStatus.DECLINED]: 'Décliné',
};

export const MATCHED_CANDIDATE_STATUS_BADGE_CLASS: Record<MatchedCandidateStatus, string> = {
    [MatchedCandidateStatus.RETAINED]: 'bg-blue text-white',
    [MatchedCandidateStatus.OFFER_SEND]: 'bg-purple text-white',
    [MatchedCandidateStatus.ACCEPTED]: 'bg-success text-white',
    [MatchedCandidateStatus.DECLINED]: 'bg-danger text-white',
};

export const MATCHED_CANDIDATE_STATUS_ORDER: MatchedCandidateStatus[] = [
    MatchedCandidateStatus.RETAINED,
    MatchedCandidateStatus.OFFER_SEND,
    MatchedCandidateStatus.ACCEPTED,
    MatchedCandidateStatus.DECLINED,
];
