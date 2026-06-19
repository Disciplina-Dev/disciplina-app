export enum ProposedCandidateAnswer {
    REFUSED = 'REFUSED',
    ACCEPTED = 'ACCEPTED',
    FAVORITE = 'FAVORITE',
}

export const PROPOSED_CANDIDATE_ANSWER_LABELS: Record<ProposedCandidateAnswer, string> = {
    [ProposedCandidateAnswer.REFUSED]: 'Refusé',
    [ProposedCandidateAnswer.ACCEPTED]: 'Accepté',
    [ProposedCandidateAnswer.FAVORITE]: 'Coup de cœur',
};

export const PROPOSED_CANDIDATE_ANSWER_BADGE_CLASS: Record<ProposedCandidateAnswer, string> = {
    [ProposedCandidateAnswer.REFUSED]: 'bg-danger text-white',
    [ProposedCandidateAnswer.ACCEPTED]: 'bg-success text-white',
    [ProposedCandidateAnswer.FAVORITE]: 'bg-purple text-white',
};

export const PROPOSED_CANDIDATE_ANSWER_ORDER: ProposedCandidateAnswer[] = [
    ProposedCandidateAnswer.FAVORITE,
    ProposedCandidateAnswer.ACCEPTED,
    ProposedCandidateAnswer.REFUSED,
];
