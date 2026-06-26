export enum InterviewConclusion {
  REJECTED = 'REJECTED',
  IMMERSING = 'IMMERSING',
  CONTRACT = 'CONTRACT',
}

export const INTERVIEW_CONCLUSION_LABELS: Record<InterviewConclusion, string> = {
  [InterviewConclusion.REJECTED]: 'Non concluant',
  [InterviewConclusion.IMMERSING]: 'En immersion',
  [InterviewConclusion.CONTRACT]: 'En contrat',
}

export const INTERVIEW_CONCLUSION_BADGE_CLASS: Record<InterviewConclusion, string> = {
  [InterviewConclusion.REJECTED]: 'bg-danger text-white',
  [InterviewConclusion.IMMERSING]: 'bg-blue text-white',
  [InterviewConclusion.CONTRACT]: 'bg-success text-white',
}
