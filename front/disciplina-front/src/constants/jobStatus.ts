import { OfferStatus } from '@/features/matching/constants/jobEnums'

export const JOB_STATUS_LABELS: Record<OfferStatus, string> = {
  [OfferStatus.NOT_MATCHED]: 'Pas de match',
  [OfferStatus.MATCHED]: 'Matché',
  [OfferStatus.CV_SEND]: 'CV envoyé',
  [OfferStatus.IMMERSING]: 'Immersion',
  [OfferStatus.CONTRACT]: 'En contrat',
}

export const JOB_STATUS_BADGE_CLASS: Record<OfferStatus, string> = {
  [OfferStatus.NOT_MATCHED]: 'bg-gray-100 text-gray-600',
  [OfferStatus.MATCHED]: 'bg-blue-light text-blue',
  [OfferStatus.CV_SEND]: 'bg-purple-light text-purple',
  [OfferStatus.IMMERSING]: 'bg-pink-light text-pink',
  [OfferStatus.CONTRACT]: 'bg-success-bg text-success',
}

export const JOB_STATUS_ORDER: OfferStatus[] = [
  OfferStatus.NOT_MATCHED,
  OfferStatus.MATCHED,
  OfferStatus.CV_SEND,
  OfferStatus.IMMERSING,
  OfferStatus.CONTRACT,
]

export const MANUAL_JOB_STATUSES: OfferStatus[] = [OfferStatus.CV_SEND, OfferStatus.IMMERSING, OfferStatus.CONTRACT]
