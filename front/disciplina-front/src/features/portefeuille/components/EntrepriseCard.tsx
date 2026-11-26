import { IconBell, IconCheck, IconCopy, IconFile, IconHash, IconMail, IconMapPin, IconMessage, IconPhone, IconTrash, IconUser, IconUserPlus } from '@/components/ui/icons'
import { useState } from 'react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { Permission } from '@/store/authStore'
import { STATUS_CONFIG } from './statusConfig'

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClick: () => void
  onClaim: () => void
  onDelete?: (entreprise: Entreprise) => void
}

export default function EntrepriseCard({ entreprise, currentUser, onClick, onClaim, onDelete }: Props) {
  const [copied, setCopied] = useState(false)

  const canDelete =
    (currentUser.permission === Permission.RESPONSABLE || currentUser.permission === Permission.ADMIN) &&
    !!onDelete

  const s = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const isUnassigned = !entreprise.proprietaire_id
  const hasNote = !!entreprise.note?.trim()
  const hasConclusion = !!entreprise.conclusion?.trim()
  const hasSuivi = hasNote || hasConclusion

  const relanceLabel = (() => {
    if (!entreprise.date_relance) return null
    try {
      const d = new Date(entreprise.date_relance)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
      const formatted = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      if (diffDays < -2) return { text: formatted, color: 'text-[var(--ds-danger)]', bg: 'bg-[var(--ds-danger-bg)] border-danger/20' }
      if (diffDays <= 2) return { text: formatted, color: 'text-[var(--ds-warning)]', bg: 'bg-[var(--ds-warning-bg)] border-warning/20' }
      return { text: formatted, color: 'text-[var(--ds-text-subtle)]', bg: 'bg-[var(--ds-surface-sunken)] border-[var(--ds-border)]' }
    } catch { return null }
  })()

  const canClaim =
    isUnassigned &&
    (currentUser.role?.toUpperCase() === 'COMMERCIAL' ||
      currentUser.role?.toUpperCase() === 'RESPONSABLE' ||
      currentUser.role?.toUpperCase() === 'ADMIN')

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(entreprise)
  }

  return (
    <article
      onClick={onClick}
      className={[
        'group relative flex flex-col cursor-pointer rounded-xl bg-[var(--ds-surface)]',
        'border border-[var(--ds-border)] transition-all duration-200',
        'hover:border-blue/25 hover:-translate-y-0.5',
        'hover:shadow-[0_8px_32px_-8px_rgba(17,48,167,0.10),0_2px_8px_-2px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Company name */}
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug text-[var(--ds-text)] line-clamp-2 group-hover:text-blue transition-colors duration-150">
              {entreprise.nom_commercial ?? '—'}
            </h4>
            {entreprise.secteur && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                <IconMapPin className="h-3 w-3" />
                {entreprise.secteur}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${s.pill} ${s.ring}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            {/* Delete action — visible to Responsable/Admin */}
            {canDelete && (
              <button
                onClick={handleDelete}
                title="Supprimer l'entreprise"
                aria-label="Supprimer l'entreprise"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)] transition-colors"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Commercial ── */}
        <div className="flex items-center gap-2 mb-3.5">
          <IconUser className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
          {entreprise.commercial ? (
            <span className="text-[13px] font-medium text-[var(--ds-text-muted)]">
              {entreprise.commercial}
            </span>
          ) : (
            <span className="text-[13px] italic text-[var(--ds-text-subtle)]">Non attribué</span>
          )}
        </div>

        {/* ── Contact row ── */}
        <div className="space-y-2">
          {entreprise.telephone && (
            <div className="flex items-center gap-2">
              <IconPhone className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="text-[13px] text-[var(--ds-text-muted)] truncate">
                {entreprise.telephone}
              </span>
            </div>
          )}

          {entreprise.email && (
            <div className="flex items-center gap-2">
              <IconMail className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="text-[13px] text-[var(--ds-text-muted)] truncate flex-1 min-w-0">
                {entreprise.email}
              </span>
              <button
                onClick={copyEmail}
                title="Copier l'adresse e-mail"
                className={[
                  'ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  'text-[var(--ds-text-subtle)] transition-all duration-150',
                  'hover:bg-blue-light hover:text-blue',
                  copied ? 'text-[var(--ds-success)]!' : '',
                ].join(' ')}
              >
                {copied ? (
                  <IconCheck className="h-3.5 w-3.5 text-[var(--ds-success)]" />
                ) : (
                  <IconCopy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Suivi block ──────────────────────────────────────── */}
      {hasSuivi && (
        <div className="mx-3 mb-3 rounded-lg bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-3.5 py-3 space-y-2.5">
          {hasNote && (
            <div className="flex gap-2.5">
              <IconFile className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)] mt-[1px]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)] mb-0.5">
                  Note
                </p>
                <p className="text-[13px] leading-relaxed text-[var(--ds-text-muted)] line-clamp-2">
                  {entreprise.note}
                </p>
              </div>
            </div>
          )}

          {hasConclusion && (
            <div className="flex gap-2.5">
              <IconMessage className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)] mt-[1px]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)] mb-0.5">
                  Conclusion
                </p>
                <p className="text-[13px] leading-relaxed text-[var(--ds-text-muted)] line-clamp-2">
                  {entreprise.conclusion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Relance badge ────────────────────────────────────── */}
      {relanceLabel && (
        <div className="mx-3 mb-2">
          <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${relanceLabel.bg}`}>
            <IconBell className={`h-3 w-3 shrink-0 ${relanceLabel.color}`} />
            <span className={`text-[11px] font-medium ${relanceLabel.color}`}>
              Relance {relanceLabel.text}
            </span>
          </div>
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
              <IconUserPlus className="h-3.5 w-3.5" />
              Récupérer le dossier
            </button>
          ) : entreprise.siret ? (
            <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--ds-border)]">
              <IconHash className="h-3 w-3 text-[var(--ds-text-subtle)]" />
              <span className="text-[11px] font-mono text-[var(--ds-text-subtle)] tracking-wide">
                {entreprise.siret}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}
