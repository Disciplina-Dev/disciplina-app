import { useEffect, useState } from 'react'
import { ChevronDown, Handshake } from 'lucide-react'
import { offerGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATE_MATCH_PROPOSITIONS } from '@/graphql/queries'
import { MatchedCandidateStatus } from '@/constants/matchedCandidateStatus'

export interface MatchProposition {
  offerId: string
  companyName: string | null
  status: MatchedCandidateStatus | string | null
  title: string | null
  jobRole: string | null
  needsAnalysisId: string | null
}

type ResponseKind = 'yes' | 'no' | 'pending'

const RESPONSE_KIND: Partial<Record<MatchedCandidateStatus, ResponseKind>> = {
  [MatchedCandidateStatus.ACCEPTED]: 'yes',
  [MatchedCandidateStatus.DECLINED]: 'no',
  [MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND]: 'pending',
}

const RESPONSE_LABEL: Record<ResponseKind, string> = {
  yes: 'Oui',
  no: 'Non',
  pending: 'En attente',
}

const RESPONSE_BADGE_CLASS: Record<ResponseKind, string> = {
  yes: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]',
  no: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]',
  pending: 'bg-[var(--ds-surface)] text-[var(--ds-text-muted)] ring-1 ring-[var(--ds-border)]',
}

// Oui, non, puis propositions sans réponse.
const RESPONSE_ORDER: ResponseKind[] = ['yes', 'no', 'pending']

function kindOf(status: MatchProposition['status']): ResponseKind | null {
  if (!status) return null
  return RESPONSE_KIND[status as MatchedCandidateStatus] ?? null
}

export default function CandidateMatchPropositionsCallout({ candidateId }: { candidateId: string }) {
  const [propositions, setPropositions] = useState<MatchProposition[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    offerGraphqlClient
      .query(GET_CANDIDATE_MATCH_PROPOSITIONS, { candidateId })
      .toPromise()
      .then((result) => {
        if (cancelled) return
        setPropositions((result.data?.candidateMatchPropositions as MatchProposition[] | undefined) ?? [])
      })
      .catch(() => {
        if (!cancelled) setPropositions([])
      })
    return () => {
      cancelled = true
    }
  }, [candidateId])

  // Callout discret : rien tant que le chargement n'est pas terminé, rien s'il
  // n'y a aucune proposition.
  if (!propositions || propositions.length === 0) return null

  const counts: Record<ResponseKind, number> = { yes: 0, no: 0, pending: 0 }
  for (const proposition of propositions) {
    const kind = kindOf(proposition.status)
    if (kind) counts[kind] += 1
  }

  const sorted = [...propositions].sort((a, b) => {
    const kindA = kindOf(a.status)
    const kindB = kindOf(b.status)
    const rankA = kindA ? RESPONSE_ORDER.indexOf(kindA) : RESPONSE_ORDER.length
    const rankB = kindB ? RESPONSE_ORDER.indexOf(kindB) : RESPONSE_ORDER.length
    return rankA - rankB
  })

  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-3 text-left cursor-pointer"
      >
        <Handshake size={16} className="shrink-0 text-[var(--ds-text-subtle)]" />
        <span className="text-sm font-semibold text-[var(--ds-text)]">Propositions de matching</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {RESPONSE_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
            <span
              key={kind}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${RESPONSE_BADGE_CLASS[kind]}`}
            >
              {counts[kind]} {RESPONSE_LABEL[kind].toLowerCase()}
            </span>
          ))}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-[var(--ds-text-subtle)] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <ul className="flex flex-col gap-1.5 border-t border-[var(--ds-border)] px-4 py-3">
          {sorted.map((proposition) => {
            const kind = kindOf(proposition.status)
            return (
              <li
                key={proposition.offerId}
                className="flex items-center gap-2 flex-wrap text-sm text-[var(--ds-text)]"
              >
                <span className="font-semibold">{proposition.companyName || 'Entreprise inconnue'}</span>
                {[proposition.title, proposition.jobRole].filter(Boolean).length > 0 && (
                  <span className="text-xs text-[var(--ds-text-subtle)]">
                    ({[proposition.title, proposition.jobRole].filter(Boolean).join(' · ')})
                  </span>
                )}
                {kind && (
                  <span
                    className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${RESPONSE_BADGE_CLASS[kind]}`}
                  >
                    {RESPONSE_LABEL[kind]}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
