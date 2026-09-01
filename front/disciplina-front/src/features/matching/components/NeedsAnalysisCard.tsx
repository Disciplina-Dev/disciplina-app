import { Building2, MapPin, Hash, Briefcase, Calendar, Landmark } from 'lucide-react'
import type { NeedsAnalysis } from '@/types/needsAnalysis'
import { AB_STATUS_BADGE } from '@/features/abEntreprise/components/ABDetailContent'
import { ADMINISTRATION_LABELS } from '@/types/needsAnalysis'
import { SECTOR_LABELS } from '@/data/sectors'
import { formatCommune } from '@/data/reunionCommunes'
import { TP_TYPE_LABELS } from '@/data/candidateTemplates'
import type { TitleProfessionalType } from '@/types/candidate'

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
  const badge = AB_STATUS_BADGE[analysis.status ?? 'BROUILLON'] ?? AB_STATUS_BADGE['BROUILLON']
  const positions = analysis.positions ?? []
  const communes = [...new Set(positions.flatMap((p) => p.localisation ?? []))]
  const localisation = communes.length ? communes.map(formatCommune).join(' · ') : analysis.companyInfos?.commune
  const activities = analysis.companyInfos?.activities ?? []

  return (
    <article
      onClick={onClick}
      className={[
        'group flex flex-col cursor-pointer rounded-xl bg-white',
        'border border-gray-100 transition-all duration-200',
        'hover:border-blue/25 hover:-translate-y-0.5',
        'hover:shadow-[0_8px_32px_-8px_rgba(17,48,167,0.10),0_2px_8px_-2px_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* ─── Header ─── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-blue transition-colors">
              <Building2 className="h-4 w-4 shrink-0 text-gray-300" />
              <span className="truncate">{analysis.companyInfos?.name ?? '—'}</span>
            </h4>
            {analysis.companyInfos?.siret && (
              <span className="mt-1 flex items-center gap-1 text-[11px] font-mono text-gray-400">
                <Hash className="h-3 w-3 shrink-0" />
                {analysis.companyInfos.siret}
              </span>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>

        {localisation && (
          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-gray-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span className="truncate">{localisation}</span>
          </div>
        )}

        {activities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <span key={a} className="rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-blue">
                {SECTOR_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        )}

        {analysis.administrationType && analysis.administrationType !== 'NON_RENSEIGNE' && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-600">
            <Landmark className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span>{ADMINISTRATION_LABELS[analysis.administrationType as keyof typeof ADMINISTRATION_LABELS] ?? analysis.administrationType}</span>
          </div>
        )}
      </div>

      {/* ─── Postes ─── */}
      {positions.length > 0 && (
        <div className="mx-3 mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Postes ({positions.length})
          </p>
          <ul className="space-y-2">
            {positions.map((p, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0 text-[13px] font-medium text-gray-700">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                    <span className="truncate">{p.jobRole || p.title || 'Poste'}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-gray-500">×{p.count ?? 1}</span>
                </div>
                {(p.desiredTp ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-5">
                    {(p.desiredTp ?? []).map((tp, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
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
      <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-4 pt-1 text-[11px] text-gray-400">
        <span className="font-medium text-gray-500">
          {analysis.positionsCount ?? 0} poste{(analysis.positionsCount ?? 0) > 1 ? 's' : ''} à pourvoir
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatCreatedAt(analysis.createdAt)}
        </span>
      </div>
    </article>
  )
}
