import {
  Copy,
  Check,
  Phone,
  Mail,
  User,
  UserPlus,
  MessageSquare,
  FileText,
  Hash,
} from 'lucide-react'
import { useState } from 'react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClick: () => void
  onClaim: () => void
}

const STATUS_CONFIG = {
  Oui: {
    label: 'Oui',
    dot: 'bg-success',
    text: 'text-success',
    pill: 'bg-success-bg text-success',
    ring: 'ring-success/20',
  },
  Non: {
    label: 'Non',
    dot: 'bg-danger',
    text: 'text-danger',
    pill: 'bg-danger-bg text-danger',
    ring: 'ring-danger/20',
  },
  'À Réfléchir': {
    label: 'À Réfléchir',
    dot: 'bg-warning',
    text: 'text-warning',
    pill: 'bg-warning-bg text-warning',
    ring: 'ring-warning/20',
  },
} as const

export default function EntrepriseCard({ entreprise, currentUser, onClick, onClaim }: Props) {
  console.log(entreprise);
  const [copied, setCopied] = useState(false)

  const s = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const isUnassigned = !entreprise.proprietaire_id
  const hasNote = !!entreprise.note?.trim()
  const hasConclusion = !!entreprise.conclusion?.trim()
  const hasSuivi = hasNote || hasConclusion

  const canClaim =
    isUnassigned &&
    (currentUser.role === 'commercial' ||
      currentUser.role === 'responsable' ||
      currentUser.role === 'admin')

  const copyEmail = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entreprise.email) return
    navigator.clipboard.writeText(entreprise.email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClaim()
  }

  return (
    <article
      onClick={onClick}
      className={[
        'group relative flex flex-col cursor-pointer rounded-xl bg-white',
        'border border-gray-100 transition-all duration-200',
        'hover:border-blue/25 hover:-translate-y-0.5',
        'hover:shadow-[0_8px_32px_-8px_rgba(17,48,167,0.10),0_2px_8px_-2px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Company name */}
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-blue transition-colors duration-150">
              {entreprise.nom_commercial ?? '—'}
            </h4>
            {entreprise.secteur && (
              <p className="mt-1 text-xs font-normal text-gray-400 truncate">
                {entreprise.secteur}
              </p>
            )}
          </div>

          {/* Status badge — discreet, top-right */}
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${s.pill} ${s.ring}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>

        {/* ── Commercial ── */}
        <div className="flex items-center gap-2 mb-3.5">
          <User className="h-3.5 w-3.5 shrink-0 text-gray-300" />
          {entreprise.commercial ? (
            <span className="text-[13px] font-medium text-gray-600">
              {entreprise.commercial}
            </span>
          ) : (
            <span className="text-[13px] italic text-gray-300">Non attribué</span>
          )}
        </div>

        {/* ── Contact row ── */}
        <div className="space-y-2">
          {entreprise.telephone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              <span className="text-[13px] text-gray-600 truncate">
                {entreprise.telephone}
              </span>
            </div>
          )}

          {entreprise.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              <span className="text-[13px] text-gray-600 truncate flex-1 min-w-0">
                {entreprise.email}
              </span>
              <button
                onClick={copyEmail}
                title="Copier l'adresse e-mail"
                className={[
                  'ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  'text-gray-300 transition-all duration-150',
                  'hover:bg-blue-light hover:text-blue',
                  copied ? 'text-success!' : '',
                ].join(' ')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Suivi block ──────────────────────────────────────── */}
      {hasSuivi && (
        <div className="mx-3 mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3 space-y-2.5">
          {hasNote && (
            <div className="flex gap-2.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-gray-300 mt-[1px]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Note
                </p>
                <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-2">
                  {entreprise.note}
                </p>
              </div>
            </div>
          )}

          {hasConclusion && (
            <div className="flex gap-2.5">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-300 mt-[1px]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Conclusion
                </p>
                <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-2">
                  {entreprise.conclusion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Footer ───────────────────────────────────────────── */}
      {(entreprise.siret || canClaim) && (
        <div
          className={[
            'px-5 pb-4 mt-auto',
            hasSuivi ? '' : 'pt-0',
          ].join(' ')}
        >
          {canClaim ? (
            <button
              onClick={handleClaim}
              className={[
                'w-full flex items-center justify-center gap-1.5 rounded-lg',
                'border border-blue/20 bg-blue-light py-2',
                'text-[12px] font-semibold text-blue',
                'transition-all duration-150 hover:bg-blue hover:text-white hover:border-blue',
              ].join(' ')}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Récupérer le dossier
            </button>
          ) : entreprise.siret ? (
            <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
              <Hash className="h-3 w-3 text-gray-200" />
              <span className="text-[11px] font-mono text-gray-300 tracking-wide">
                {entreprise.siret}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}
