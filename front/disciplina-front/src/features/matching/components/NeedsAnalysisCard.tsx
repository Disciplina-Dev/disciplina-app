import { useState } from 'react'
import { IconCalendar, IconCompany, IconExternalLink, IconEye, IconHash, IconInstitution, IconJob, IconMapPin } from '@/components/ui/icons'
import type { NeedsAnalysis } from '@/types/needsAnalysis'
import { AB_STATUS_BADGE } from '@/features/abEntreprise/components/ABDetailContent'
import { ADMINISTRATION_LABELS } from '@/types/needsAnalysis'
import { SECTOR_LABELS } from '@/data/sectors'
import { formatCommune } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import type { TitleProfessionalType } from '@/types/candidate'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'
import TruncatedBadge from '@/components/ui/TruncatedBadge'

interface Props {
  analysis: NeedsAnalysis
  onClick: () => void
}

function formatCreatedAt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function tpLabel(tp?: string | null): string {
  if (!tp) return '—'
  return TP_TYPE_LABELS[tp as TitleProfessionalType] ?? tp
}

export default function NeedsAnalysisCard({ analysis, onClick }: Props) {
  const [showAbDetail, setShowAbDetail] = useState(false)
  const badge = AB_STATUS_BADGE[analysis.status ?? 'BROUILLON'] ?? AB_STATUS_BADGE['BROUILLON']
  const isSigned = analysis.status === 'SIGNE'
  const positions = analysis.positions ?? []
  const communes = [...new Set(positions.flatMap((p) => p.localisation ?? []))]
  const localisation = communes.length ? communes.map(formatCommune).join(' · ') : analysis.companyInfos?.commune
  const activities = analysis.companyInfos?.activities ?? []

  const handleSignedBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (analysis.driveFolderUrl) {
      window.open(analysis.driveFolderUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleSeeAb = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowAbDetail(true)
  }

  return (
    <article
      onClick={onClick}
      className={[
        'group flex flex-col cursor-pointer rounded-xl bg-[var(--ds-surface)]',
        'border border-[var(--ds-border)] transition-all duration-200',
        'hover:border-blue/25 hover:-translate-y-0.5',
        'hover:shadow-[0_8px_32px_-8px_rgba(17,48,167,0.10),0_2px_8px_-2px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-[var(--ds-text)] group-hover:text-blue transition-colors">
              <IconCompany className="h-4 w-4 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="truncate">{analysis.companyInfos?.name ?? '—'}</span>
            </h4>
            {analysis.companyInfos?.siret && (
              <span className="mt-1 flex items-center gap-1 text-[11px] font-mono text-[var(--ds-text-subtle)]">
                <IconHash className="h-3 w-3 shrink-0" />
                {analysis.companyInfos.siret}
              </span>
            )}
          </div>
          {isSigned && analysis.driveFolderUrl ? (
            <button
              type="button"
              onClick={handleSignedBadgeClick}
              title="Ouvrir le dossier Drive (mandat signé)"
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${badge.bg} ${badge.text} hover:opacity-80 hover:ring-1 hover:ring-[var(--ds-success)] cursor-pointer transition`}
            >
              {badge.label}
              <IconExternalLink className="h-3 w-3" />
            </button>
          ) : (
            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          )}
        </div>

        {localisation && (
          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)]">
            <IconMapPin className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
            <span className="truncate">{localisation}</span>
          </div>
        )}

        {activities.length > 0 && (
          // Les secteurs référencés ont un libellé court ; un code NAF non
          // référencé retombe sur son intitulé brut, qui est une phrase.
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <TruncatedBadge key={a} tone="accent">
                {SECTOR_LABELS[a] ?? a}
              </TruncatedBadge>
            ))}
          </div>
        )}

        {analysis.administrationType && analysis.administrationType !== 'NON_RENSEIGNE' && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
            <IconInstitution className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
            <span>{ADMINISTRATION_LABELS[analysis.administrationType as keyof typeof ADMINISTRATION_LABELS] ?? analysis.administrationType}</span>
          </div>
        )}
      </div>

      {/* ─── Postes ─── */}
      {positions.length > 0 && (
        <div className="mx-3 mb-3 rounded-lg bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] px-3.5 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-subtle)]">
            Postes ({positions.length})
          </p>
          <ul className="space-y-2">
            {positions.map((p, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-[13px] font-medium text-[var(--ds-text-muted)]">
                    <IconJob className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-subtle)]" />
                    <span className="truncate">{p.jobRole || p.title || 'Poste'}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--ds-text-subtle)]">×{p.count ?? 1}</span>
                </div>
                {(p.desiredTp ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-5">
                    {(p.desiredTp ?? []).map((tp, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-[var(--ds-surface)] border border-[var(--ds-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ds-text-muted)]"
                      >
                        {tpLabel(tp.tpType)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Footer ─── */}
      <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-4 pt-1 text-[11px] text-[var(--ds-text-subtle)]">
        <span className="font-medium text-[var(--ds-text-subtle)]">
          {analysis.positionsCount ?? 0} poste{(analysis.positionsCount ?? 0) > 1 ? 's' : ''} à pourvoir
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSeeAb}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ds-text-muted)] hover:border-blue hover:text-blue transition-colors"
          >
            <IconEye className="h-3 w-3" />
            Voir l'AB
          </button>
          <span className="flex items-center gap-1">
            <IconCalendar className="h-3 w-3" />
            {formatCreatedAt(analysis.createdAt)}
          </span>
        </div>
      </div>
      {showAbDetail && (
        <ABDetailModal id={analysis.id} onClose={() => setShowAbDetail(false)} />
      )}
    </article>
  )
}
