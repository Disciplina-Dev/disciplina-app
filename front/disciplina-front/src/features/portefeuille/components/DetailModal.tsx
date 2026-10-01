import { IconBell, IconCalendar, IconCheck, IconClose, IconCompany, IconCopy, IconEdit, IconFile, IconHash, IconJob, IconMail, IconMapPin, IconPhone, IconTaskList, IconTrash, IconUser, IconUserCheck } from '@/components/ui/icons'
import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { fullName } from '@/store/authStore'
import { useStaffDirectory } from '@/hooks/useStaffDirectory'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import { useNeedsAnalysesByCompany, useDeleteNeedsAnalysis } from '@/graphql/hooks'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'
import RelanceHistorySection from '@/features/portefeuille/components/RelanceHistorySection'

const STATUS_CONFIG = {
  Oui: { bg: 'bg-[var(--ds-success-bg)]', text: 'text-[var(--ds-success)]', dot: 'bg-success' },
  'Oui OF': { bg: 'bg-[var(--ds-success-bg)]', text: 'text-[var(--ds-success)]', dot: 'bg-success' },
  Non: { bg: 'bg-[var(--ds-danger-bg)]', text: 'text-[var(--ds-danger)]', dot: 'bg-danger' },
  'À Réfléchir': { bg: 'bg-[var(--ds-warning-bg)]', text: 'text-[var(--ds-warning)]', dot: 'bg-warning' },
  Relance: { bg: 'bg-blue/10', text: 'text-blue', dot: 'bg-blue' },
  'Réponds pas': { bg: 'bg-[var(--ds-surface-sunken)]', text: 'text-[var(--ds-text-subtle)]', dot: 'bg-[var(--ds-text-subtle)]' },
  Fermé: { bg: 'bg-[var(--ds-surface-sunken)]', text: 'text-[var(--ds-text-muted)]', dot: 'bg-[var(--ds-text-muted)]' },
} as const

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onEdit: () => void
  onCreateAB: () => void
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm text-[var(--ds-text)] break-words">{value}</p>
      </div>
    </div>
  )
}

function CopyableField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-[var(--ds-text)] break-all">{value}</p>
          <button
            onClick={copy}
            title="Copier"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ds-text-subtle)] transition-colors hover:bg-blue-light hover:text-blue"
          >
            {copied ? <IconCheck className="h-3.5 w-3.5 text-[var(--ds-success)]" /> : <IconCopy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: fr })
  } catch {
    return iso
  }
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  BROUILLON:             { bg: 'bg-[var(--ds-surface-sunken)]',    text: 'text-[var(--ds-text-muted)]',  label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE:  { bg: 'bg-[var(--ds-warning-bg)]',  text: 'text-[var(--ds-warning)]', label: 'En attente de signature' },
  SIGNE:                 { bg: 'bg-[var(--ds-success-bg)]',   text: 'text-[var(--ds-success)]', label: 'Signé' },
  EXPIRE:                { bg: 'bg-[var(--ds-danger-bg)]',     text: 'text-[var(--ds-danger)]',   label: 'Expiré' },
}

export default function DetailModal({ entreprise, currentUser, onClose, onEdit, onCreateAB }: Props) {
  const { directory } = useStaffDirectory()
  const status = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const owner = entreprise.proprietaire_id ? directory[String(entreprise.proprietaire_id)] : null
  const abResult = useNeedsAnalysesByCompany(entreprise.id ? Number(entreprise.id) : null)
  const abList = abResult.data?.needsAnalysesByCompany ?? []
  const [selectedAbId, setSelectedAbId] = useState<string | null>(null)
  const [selectedAbIds, setSelectedAbIds] = useState<Set<string>>(new Set())
  const [mailOpen, setMailOpen] = useState(false)
  const { deleteNeedsAnalysis } = useDeleteNeedsAnalysis()

  const toggleSelect = (id: string) => {
    setSelectedAbIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    await Promise.all([...selectedAbIds].map((id) => deleteNeedsAnalysis(id)))
    setSelectedAbIds(new Set())
    abResult.refetch()
  }

  const canEdit =
    currentUser.role?.toUpperCase() === 'ADMIN' ||
    currentUser.role?.toUpperCase() === 'RESPONSABLE' ||
    String(entreprise.proprietaire_id) === String(currentUser.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-[var(--ds-border)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-light">
              <IconCompany className="h-5 w-5 text-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--ds-text)] leading-tight truncate">
                {entreprise.nom_commercial ?? 'Entreprise sans nom'}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {entreprise.status}
                </span>
                {entreprise.secteur && (
                  <span className="text-xs text-[var(--ds-text-subtle)]">{entreprise.secteur}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<IconMail className="h-3.5 w-3.5" />}
                onClick={() => setMailOpen(true)}
              >
                Envoyer un mail
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<IconFile className="h-3.5 w-3.5" />}
                onClick={onCreateAB}
              >
                Créer une Analyse (AB)
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<IconEdit className="h-3.5 w-3.5" />}
                  onClick={onEdit}
                >
                  Modifier
                </Button>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)]"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Left column */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest">Informations générales</p>
              <Field icon={<IconHash className="h-4 w-4" />} label="SIRET" value={entreprise.siret} />
              <Field icon={<IconJob className="h-4 w-4" />} label="Métier / Description" value={entreprise.metier} />
              <Field icon={<IconMapPin className="h-4 w-4" />} label="Adresse" value={entreprise.adresse} />
              <Field icon={<IconHash className="h-4 w-4" />} label="IDCC" value={entreprise.idcc} />
              <Field icon={<IconUser className="h-4 w-4" />} label="Représentant légal" value={entreprise.representant_legal} />
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest">Contact</p>
              <Field icon={<IconPhone className="h-4 w-4" />} label="Téléphone" value={entreprise.telephone} />
              <CopyableField icon={<IconMail className="h-4 w-4" />} label="Adresse e-mail" value={entreprise.email} />

              <div className="pt-2 border-t border-[var(--ds-border)]">
                <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-3">Suivi commercial</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
                      <IconUserCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide">Propriétaire</p>
                      {owner ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold"
                            style={{ backgroundColor: owner.color }}
                          >
                            {owner.initials}
                          </span>
                          <span className="text-sm text-[var(--ds-text)]">{fullName(owner)}</span>
                          <span className="text-xs text-[var(--ds-text-subtle)]">({owner.role})</span>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--ds-text-subtle)] italic mt-0.5">Non attribué</p>
                      )}
                    </div>
                  </div>
                  <Field
                    icon={<IconCalendar className="h-4 w-4" />}
                    label="Date d'insertion"
                    value={formatDate(entreprise.date_insertion)}
                  />
                  <Field
                    icon={<IconBell className="h-4 w-4" />}
                    label="Date de relance"
                    value={formatDate(entreprise.date_relance)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AB History */}
          <div className="mt-5 pt-5 border-t border-[var(--ds-border)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest flex items-center gap-1.5">
                <IconTaskList className="h-3.5 w-3.5" />
                Analyses du besoin
              </p>
              {selectedAbIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--ds-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--ds-danger)] hover:bg-[var(--ds-danger-bg)] transition-colors"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  Supprimer ({selectedAbIds.size})
                </button>
              )}
            </div>
            {abResult.fetching && (
              <p className="text-sm text-[var(--ds-text-subtle)] italic">Chargement...</p>
            )}
            {!abResult.fetching && abList.length === 0 && (
              <p className="text-sm text-[var(--ds-text-subtle)] italic">Aucune analyse du besoin pour cette entreprise.</p>
            )}
            {abList.length > 0 && (
              <ul className="space-y-2">
                {abList.map((ab: any) => {
                  const badge = STATUS_BADGE[ab.status] ?? STATUS_BADGE['BROUILLON']
                  const isSelected = selectedAbIds.has(ab.id)
                  return (
                    <li
                      key={ab.id}
                      onClick={() => setSelectedAbId(ab.id)}
                      className={[
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                        isSelected ? 'bg-[var(--ds-accent-soft)] border border-[var(--ds-accent)]' : 'bg-[var(--ds-surface-sunken)] hover:bg-[var(--ds-accent-soft)]',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(ab.id)}
                        className="h-4 w-4 shrink-0 rounded border-[var(--ds-border-strong)] accent-blue cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[var(--ds-text)] truncate">{ab.positions?.[0]?.title ?? 'Analyse du besoin'}</span>
                        <span className="ml-2 text-xs text-[var(--ds-text-subtle)]">{ab.positionsCount} poste{ab.positionsCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ab.createdAt && (
                          <span className="text-xs text-[var(--ds-text-subtle)]">{formatDate(ab.createdAt)}</span>
                        )}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {selectedAbId && (
              <ABDetailModal
                id={selectedAbId}
                onClose={() => setSelectedAbId(null)}
                onDelete={() => {
                  setSelectedAbId(null)
                  abResult.refetch()
                }}
              />
            )}
          </div>

          {/* Historique des relances */}
          {entreprise.id && (
            <div className="mt-5 pt-5 border-t border-[var(--ds-border)]">
              <RelanceHistorySection companyId={Number(entreprise.id)} />
            </div>
          )}

          {/* Notes section */}
          {(entreprise.note || entreprise.conclusion) && (
            <div className="mt-5 space-y-3 pt-5 border-t border-[var(--ds-border)]">
              {entreprise.note && (
                <div>
                  <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-2">
                    <IconFile className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Note
                  </p>
                  <p className="text-sm text-[var(--ds-text-muted)] bg-[var(--ds-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                    {entreprise.note}
                  </p>
                </div>
              )}
              {entreprise.conclusion && (
                <div>
                  <p className="text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-2">
                    <IconFile className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Conclusion
                  </p>
                  <p className="text-sm text-[var(--ds-text-muted)] bg-[var(--ds-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                    {entreprise.conclusion}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mailOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <MailModal
            defaultTo={entreprise.email ?? ''}
            candidateName={entreprise.nom_commercial ?? undefined}
            scope="commercial"
            mode="draft"
            onClose={() => setMailOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
