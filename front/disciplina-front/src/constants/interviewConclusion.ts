export enum InterviewConclusion {
  REJECTED = 'REJECTED',
  IMMERSING = 'IMMERSING',
  CONTRACT = 'CONTRACT',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
}

export const INTERVIEW_CONCLUSION_LABELS: Record<InterviewConclusion, string> = {
  [InterviewConclusion.REJECTED]: 'Non concluant',
  [InterviewConclusion.IMMERSING]: 'En immersion',
  [InterviewConclusion.CONTRACT]: 'En contrat',
  [InterviewConclusion.PRESENT]: 'Présent',
  [InterviewConclusion.ABSENT]: 'Absent',
  [InterviewConclusion.APPOINTMENT_CANCELLED]: 'Rendez vous annulé',
}

export const INTERVIEW_CONCLUSION_BADGE_CLASS: Record<InterviewConclusion, string> = {
  [InterviewConclusion.REJECTED]: 'bg-danger text-white',
  [InterviewConclusion.IMMERSING]: 'bg-blue text-white',
  [InterviewConclusion.CONTRACT]: 'bg-success text-white',
  [InterviewConclusion.PRESENT]: 'bg-success text-white',
  [InterviewConclusion.ABSENT]: 'bg-warning text-white',
  [InterviewConclusion.APPOINTMENT_CANCELLED]: 'bg-gray-200 text-gray-700',
}
