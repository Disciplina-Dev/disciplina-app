import { useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { offerGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATE_SENT_COMPANIES } from '@/graphql/queries'
import {
  MATCHED_CANDIDATE_STATUS_BADGE_CLASS,
  MATCHED_CANDIDATE_STATUS_LABELS,
  MatchedCandidateStatus,
} from '@/constants/matchedCandidateStatus'

export interface SentCompany {
  offerId: string
  companyName: string | null
  status: MatchedCandidateStatus | string | null
  title: string | null
  jobRole: string | null
  needsAnalysisId: string | null
}

export default function CandidateSentCompaniesCallout({ candidateId }: { candidateId: string }) {
  const [companies, setCompanies] = useState<SentCompany[] | null>(null)

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    offerGraphqlClient
      .query(GET_CANDIDATE_SENT_COMPANIES, { candidateId })
      .toPromise()
      .then((result) => {
        if (cancelled) return
        if (result.data?.candidateSentCompanies) {
          setCompanies(result.data.candidateSentCompanies as SentCompany[])
        } else {
          setCompanies([])
        }
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
    return () => {
      cancelled = true
    }
  }, [candidateId])

  if (companies === null) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-purple/20 bg-purple-light/40 px-4 py-3 text-sm text-purple">
        <Loader2 size={16} className="animate-spin shrink-0" />
        Vérification des envois en entreprise…
      </div>
    )
  }

  if (companies.length === 0) return null

  return (
    <div className="rounded-xl border border-purple/30 bg-purple-light/40 p-4">
      <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--color-purple)' }}>
        <Building2 size={16} className="shrink-0" />
        Candidat déjà envoyé {companies.length > 1 ? `à ${companies.length} entreprises` : 'à une entreprise'} via le matching
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {companies.map((c) => (
          <li key={c.offerId} className="flex items-center gap-2 flex-wrap text-sm text-gray-800">
            <span className="font-semibold">{c.companyName || 'Entreprise inconnue'}</span>
            {[c.title, c.jobRole].filter(Boolean).length > 0 && (
              <span className="text-xs text-gray-500">
                ({[c.title, c.jobRole].filter(Boolean).join(' · ')})
              </span>
            )}
            {c.status && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  MATCHED_CANDIDATE_STATUS_BADGE_CLASS[c.status as MatchedCandidateStatus] ?? 'bg-purple text-white'
                }`}
              >
                {MATCHED_CANDIDATE_STATUS_LABELS[c.status as MatchedCandidateStatus] ?? c.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
