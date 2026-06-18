import { JobStatus } from '@/features/matching/constants/jobEnums'

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.NOT_MATCHED]: 'Pas de match',
  [JobStatus.MATCHED]: 'Matché',
  [JobStatus.CV_SEND]: 'CV envoyé',
  [JobStatus.IMMERSING]: 'Immersion',
  [JobStatus.CONTRACT]: 'En contrat',
}

export const JOB_STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  [JobStatus.NOT_MATCHED]: 'bg-gray-100 text-gray-600',
  [JobStatus.MATCHED]: 'bg-blue-light text-blue',
  [JobStatus.CV_SEND]: 'bg-purple-light text-purple',
  [JobStatus.IMMERSING]: 'bg-pink-light text-pink',
  [JobStatus.CONTRACT]: 'bg-success-bg text-success',
}

export const JOB_STATUS_ORDER: JobStatus[] = [
  JobStatus.NOT_MATCHED,
  JobStatus.MATCHED,
  JobStatus.CV_SEND,
  JobStatus.IMMERSING,
  JobStatus.CONTRACT,
]

export const MANUAL_JOB_STATUSES: JobStatus[] = [JobStatus.CV_SEND, JobStatus.IMMERSING, JobStatus.CONTRACT]
