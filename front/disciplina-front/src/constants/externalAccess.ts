import type { ExternalAccessStatus, ExternalAccessType } from '@/api/externalAccess'

// Libellés français des statuts d'accès externe.
export const EXTERNAL_ACCESS_STATUS_LABELS: Record<ExternalAccessStatus, string> = {
  SENDING: 'Envoyé',
  PENDING: 'Ouvert',
  AUTHENTICATED: 'En cours',
  COMPLETED: 'Complété',
  LOCKED: 'Bloqué',
  EXPIRED: 'Expiré',
}

// Classes Tailwind des pastilles de statut (cohérentes avec le reste de l'app).
export const EXTERNAL_ACCESS_STATUS_BADGE: Record<ExternalAccessStatus, string> = {
  SENDING: 'bg-blue text-white',
  PENDING: 'bg-warning text-white',
  AUTHENTICATED: 'bg-cyan-500 text-white',
  COMPLETED: 'bg-success text-white',
  LOCKED: 'bg-danger text-white',
  EXPIRED: 'bg-gray-400 text-white',
}

export const EXTERNAL_ACCESS_TYPE_LABELS: Record<ExternalAccessType, string> = {
  COMPANY: 'Entreprise',
  CANDIDATE: 'Candidat',
}

export const EXTERNAL_ACCESS_TYPE_BADGE: Record<ExternalAccessType, string> = {
  COMPANY: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  CANDIDATE: 'bg-purple-light text-purple ring-1 ring-purple-light/30',
}

// Onglets de filtrage du statut. « Actifs » inclut SENDING + PENDING + AUTHENTICATED.
export const EXTERNAL_ACCESS_TABS: { key: string; label: string; statuses: ExternalAccessStatus[] | null }[] = [
  { key: 'tous', label: 'Tous', statuses: null },
  { key: 'actifs', label: 'Actifs', statuses: ['SENDING', 'PENDING', 'AUTHENTICATED'] },
  { key: 'bloque', label: 'Bloqué', statuses: ['LOCKED', 'EXPIRED'] },
  { key: 'complete', label: 'Complété', statuses: ['COMPLETED'] },
]

// Libellé du type de référence (reference_id → external_references.name).
export const EXTERNAL_REFERENCE_LABELS: Record<number, string> = {
  1: 'Import CV',
  2: 'Matching',
  3: 'Créneaux entretien',
}
