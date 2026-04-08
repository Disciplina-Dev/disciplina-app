import type { CompanyStatus } from '@/types/api'
export type { CompanyStatus }

type BadgeProps = {
  status: CompanyStatus
  className?: string
}

// Labels français pour les ENUM ASCII stockés en DB
const STATUS_CONFIG: Record<CompanyStatus, { label: string; className: string }> = {
  prospect:   { label: 'Prospect',    className: 'bg-gray-100 text-gray-700' },
  contacte:   { label: 'Contacté',    className: 'bg-blue-light text-blue' },
  ok:         { label: 'OK',          className: 'bg-success-bg text-success' },
  indecis:    { label: 'Indécis',     className: 'bg-warning-bg text-warning' },
  non:        { label: 'Non',         className: 'bg-danger-bg text-danger' },
  partenaire: { label: 'Partenaire',  className: 'bg-purple-light text-purple' },
}

export default function Badge({ status, className = '' }: BadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['prospect']
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.className} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  )
}
