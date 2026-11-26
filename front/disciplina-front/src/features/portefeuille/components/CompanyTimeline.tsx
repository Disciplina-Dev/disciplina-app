import { useState, useEffect } from 'react'
import { IconArrowRight, IconChevronDown, IconHistory, IconPhone } from '@/components/ui/icons'
import { useCompanyHistory, useContactLogs } from '@/graphql/hooks'
import { fullName } from '@/store/authStore'
import { useStaffDirectory, type StaffMember } from '@/hooks/useStaffDirectory'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try { return format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr }) } catch { return iso }
}

function authorName(directory: Record<string, StaffMember>, userID: number | null) {
  if (userID == null) return 'Inconnu'
  const user = directory[String(userID)]
  return user ? fullName(user) : `Utilisateur #${userID}`
}

// Noms bruts des colonnes DB stockés dans updated_column → libellés lisibles.
const COLUMN_LABELS: Record<string, string> = {
  user_id: 'Propriétaire',
  legal_referent: 'Représentant légal',
  name: 'Nom',
  phone: 'Téléphone',
  email: 'E-mail',
  address: 'Adresse',
  sector: 'Secteur',
  main_activity: 'Métier / Description',
  siret: 'SIRET',
  idcc: 'IDCC',
  ape: 'APE',
  notes: 'Note',
  conclusion: 'Conclusion',
  status: 'Statut',
  relance_date: 'Date de relance',
  relance_type: 'Type de relance',
  relance_template_id: 'Modèle de relance',
}

function formatColumns(raw: string) {
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => COLUMN_LABELS[c] ?? c)
    .join(', ')
}

interface CompanyTimelineProps {
  companyID: number
  /** Incrémenté par le parent après une prise de contact pour forcer le refetch. */
  refreshKey?: number
}

interface ContactEvent {
  kind: 'contact'
  id: number
  date: string
  userID: number
  comment: string
}

interface FieldChange {
  column: string
  from: string | null
  to: string | null
}

interface ModificationEvent {
  kind: 'modification'
  id: number
  date: string
  modifiedBy: number | null
  updatedColumn: string
  status: string
  previousStatus: string | null
  changes: FieldChange[]
}

type TimelineEvent = ContactEvent | ModificationEvent

interface RawContactLog {
  id: number
  createdAt: string
  userID: number
  comment: string
}

interface RawModification {
  id: number
  updatedAt: string
  modifiedBy: number | null
  updatedColumn: string
  status: string
  previousStatus: string | null
  changes: FieldChange[] | null
}

export default function CompanyTimeline({ companyID, refreshKey = 0 }: CompanyTimelineProps) {
  const [expanded, setExpanded] = useState(false)
  const { directory } = useStaffDirectory()
  const contacts = useContactLogs(expanded ? companyID : null)
  const modifications = useCompanyHistory(expanded ? companyID : null)

  // Une nouvelle prise de contact déplie et rafraîchit les deux sources.
  useEffect(() => {
    if (refreshKey > 0) {
      setExpanded(true)
      contacts.refetch()
      modifications.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const fetching = contacts.fetching || modifications.fetching

  const rawContacts: RawContactLog[] = contacts.data?.contactLogs ?? []
  const rawModifications: RawModification[] = modifications.data?.companyHistory ?? []

  const events: TimelineEvent[] = [
    ...rawContacts.map((c): ContactEvent => ({
      kind: 'contact',
      id: c.id,
      date: c.createdAt,
      userID: c.userID,
      comment: c.comment,
    })),
    ...rawModifications.map((m): ModificationEvent => ({
      kind: 'modification',
      id: m.id,
      date: m.updatedAt,
      modifiedBy: m.modifiedBy ?? null,
      updatedColumn: m.updatedColumn,
      status: m.status,
      previousStatus: m.previousStatus ?? null,
      changes: m.changes ?? [],
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="border-t border-[var(--ds-border)] pt-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <IconHistory className="w-5 h-5 text-blue" />
        <h3 className="text-lg font-semibold text-[var(--ds-text)]">Historique de l'entreprise</h3>
        {expanded && events.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-light text-blue">
            {events.length}
          </span>
        )}
      </div>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-blue font-semibold text-sm py-2 px-3 rounded-lg border border-blue-light bg-blue-light/50 hover:bg-blue-light cursor-pointer transition-colors"
        >
          <IconChevronDown className="w-4 h-4" />
          Voir l'historique
        </button>
      ) : (
        <div className="space-y-4">
          {fetching && events.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!fetching && events.length === 0 && (
            <div className="text-center py-6 px-4 bg-[var(--ds-surface-sunken)] rounded-lg">
              <p className="text-sm text-[var(--ds-text-muted)]">Aucun événement</p>
            </div>
          )}

          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((e) =>
                e.kind === 'contact' ? (
                  <div key={`c-${e.id}`} className="bg-blue-light/30 border border-blue-light rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IconPhone className="w-4 h-4 text-blue shrink-0" />
                      <span className="text-sm font-semibold text-[var(--ds-text)]">{authorName(directory, e.userID)}</span>
                      <span className="text-xs text-[var(--ds-text-subtle)]">a pris contact</span>
                      <span className="ml-auto text-xs text-[var(--ds-text-subtle)] whitespace-nowrap">{formatDate(e.date)}</span>
                    </div>
                    <p className="text-sm text-[var(--ds-text-muted)] whitespace-pre-wrap leading-relaxed pl-6">{e.comment}</p>
                  </div>
                ) : (
                  <ModificationCard key={`m-${e.id}`} event={e} />
                ),
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-blue font-semibold text-sm py-2 px-3 hover:text-blue/80 transition-colors"
          >
            Réduire
          </button>
        </div>
      )}
    </div>
  )
}

function formatValue(directory: Record<string, StaffMember>, column: string, value: string | null) {
  if (value == null || value === '') return null
  // Le propriétaire est stocké en id → affiche le nom lisible.
  if (column === 'user_id') return authorName(directory, Number(value))
  return value
}

function ChangeValue({ value }: { value: string | null }) {
  if (value == null) {
    return <span className="italic text-[var(--ds-text-subtle)]">vide</span>
  }
  return <span className="break-words">{value}</span>
}

function ModificationCard({ event }: { event: ModificationEvent }) {
  const { directory } = useStaffDirectory()
  // Fallback pour les anciennes entrées sans valeurs avant/après.
  const hasDetail = event.changes.length > 0
  const fields = formatColumns(event.updatedColumn)
  return (
    <div className="bg-[var(--ds-surface-sunken)] border border-[var(--ds-border)] rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <IconHistory className="w-4 h-4 text-[var(--ds-text-subtle)] shrink-0" />
        <span className="text-sm text-[var(--ds-text)]">
          <span className="font-semibold">{authorName(directory, event.modifiedBy)}</span>
          {fields ? <> a modifié <span className="font-medium text-[var(--ds-text-muted)]">{fields}</span></> : ' a modifié la fiche'}
        </span>
        <span className="ml-auto text-xs text-[var(--ds-text-subtle)] whitespace-nowrap">{formatDate(event.date)}</span>
      </div>

      {hasDetail && (
        <ul className="mt-2 space-y-1.5 pl-6">
          {event.changes.map((c, i) => (
            <li key={`${c.column}-${i}`} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-[var(--ds-text-muted)]">{COLUMN_LABELS[c.column] ?? c.column} :</span>
              <span className="inline-flex items-center rounded-md bg-[var(--ds-surface-sunken)] px-1.5 py-0.5 text-[var(--ds-text-subtle)] line-through decoration-gray-400">
                <ChangeValue value={formatValue(directory, c.column, c.from)} />
              </span>
              <IconArrowRight className="h-3 w-3 shrink-0 text-[var(--ds-text-subtle)]" />
              <span className="inline-flex items-center rounded-md bg-blue-light px-1.5 py-0.5 font-medium text-blue">
                <ChangeValue value={formatValue(directory, c.column, c.to)} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
