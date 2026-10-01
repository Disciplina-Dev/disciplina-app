import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconBell, IconBellOff, IconCalendar, IconClose, IconHash, IconJob, IconTaskList, IconUsers } from '@/components/ui/icons'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNeedsAnalysis, useDeleteNeedsAnalysis, useSetAbRelanceDisabled } from '@/graphql/hooks'
import { formatCommune } from '@/data/reunionCommunes'
import { formatTrainingDays } from '@/utils/trainingDays'
import { formatScheduleSlots } from '@/utils/schedule'
import type { NeedsAnalysis } from '@/types/needsAnalysis'
import { ADMINISTRATION_LABELS } from '@/types/needsAnalysis'
import { SECTEUR_LABELS } from '@/constants/secteurs'

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  BROUILLON:            { bg: 'bg-[var(--ds-surface-sunken)]',   text: 'text-[var(--ds-text-muted)]',   label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE: { bg: 'bg-[var(--ds-warning-bg)]', text: 'text-[var(--ds-warning)]', label: 'En attente de signature' },
  SIGNE:                { bg: 'bg-[var(--ds-success-bg)]',  text: 'text-[var(--ds-success)]',  label: 'Signé' },
  EXPIRE:               { bg: 'bg-[var(--ds-danger-bg)]',    text: 'text-[var(--ds-danger)]',    label: 'Expiré' },
}

const LABELS: Record<string, Record<string, string>> = {
  localisation:       { ...SECTEUR_LABELS },
  trainingDomain:     { SECRETARIAT: 'Secrétariat', VENTE: 'Vente' },
  educationLevel:     { BAC: 'Bac', BAC_PLUS_2: 'Bac +2', BAC_PLUS_3: 'Bac +3' },
  recruitmentMethod:  { ALL_CV: 'Tous les CV', PRESELECTION: 'Présélection', PRE_INTERVIEW: 'Pré-entretien' },
  immersionPeriod:    { OUI: 'Oui', NON: 'Non', A_DISCUTER: 'À discuter' },
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-[var(--ds-border)] last:border-0">
      <span className="text-xs font-medium text-[var(--ds-text-subtle)] uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-[var(--ds-text)] text-right">{value}</span>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ds-text-subtle)] uppercase tracking-widest mb-2">
        {icon}{title}
      </p>
      <div className="bg-[var(--ds-surface-sunken)] rounded-xl px-4 py-1">
        {children}
      </div>
    </div>
  )
}

interface Props {
  id: string
  onClose: () => void
  onDelete?: () => void
  onEdit?: (ab: NeedsAnalysis) => void
  onDuplicate?: (ab: NeedsAnalysis) => void
}

export default function ABDetailModal({ id, onClose, onDelete, onEdit, onDuplicate }: Props) {
  const result = useNeedsAnalysis(id)
  const { deleteNeedsAnalysis, result: deleteResult } = useDeleteNeedsAnalysis()
  const { setAbRelanceDisabled, result: relanceResult } = useSetAbRelanceDisabled()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ab = result.data?.needsAnalysis
  const badge = ab ? (STATUS_BADGE[ab.status] ?? STATUS_BADGE['BROUILLON']) : null
  const trainingDaysDisplay = formatTrainingDays(ab?.trainingDays)

  const handleDelete = async () => {
    await deleteNeedsAnalysis(id)
    onDelete?.()
    onClose()
  }

  const handleToggleRelance = async () => {
    if (!ab) return
    const disabled = !ab.isRelanceDisabled
    const res = await setAbRelanceDisabled(id, disabled)
    if (!res.error) result.refetch()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--ds-surface)] shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — responsive: title on top, actions wrap below to avoid overlap */}
        <div className="flex flex-col gap-3 p-6 pb-4 border-b border-[var(--ds-border)] sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            {result.fetching && <p className="text-sm text-[var(--ds-text-subtle)]">Chargement...</p>}
            {ab && (
              <>
                <h2 className="text-lg font-bold text-[var(--ds-text)] truncate pr-8 sm:pr-0">
                  {ab.positions?.map((p: { title?: string }) => p.title).filter(Boolean).join(' / ') || 'Analyse du besoin'}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {badge && (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  )}
                  {ab.isRelanceDisabled && ab.status === 'EN_ATTENTE_SIGNATURE' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-surface-sunken)] px-2.5 py-0.5 text-xs font-medium text-[var(--ds-text-muted)]">
                      <IconBellOff className="h-3 w-3" /> Relance désactivée
                    </span>
                  )}
                  {ab.createdAt && (
                    <span className="text-xs text-[var(--ds-text-subtle)]">
                      Créé le {format(new Date(ab.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0 w-full sm:w-auto">
            {ab && !confirmDelete && onEdit && (
              <button
                type="button"
                onClick={() => { onEdit(ab); onClose() }}
                className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-sm font-medium text-[var(--ds-text-muted)] transition-colors hover:border-blue hover:text-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
              >
                Modifier
              </button>
            )}
            {ab && !confirmDelete && onDuplicate && (
              <button
                type="button"
                onClick={() => { onDuplicate(ab); onClose() }}
                className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-sm font-medium text-[var(--ds-text-muted)] transition-colors hover:border-blue hover:text-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
              >
                Dupliquer
              </button>
            )}
            {ab && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-[var(--ds-danger)] bg-[var(--ds-surface)] px-3 py-1.5 text-sm font-medium text-[var(--ds-danger)] transition-colors hover:bg-[var(--ds-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 ml-auto sm:ml-0"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-3 bg-[var(--ds-danger-bg)] px-6 py-3 border-b border-[var(--ds-danger)]">
            <p className="text-sm text-[var(--ds-danger)] font-medium">Supprimer cette analyse du besoin ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteResult.fetching}
                className="rounded-lg bg-[var(--ds-danger)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--ds-danger)] disabled:opacity-50"
              >
                {deleteResult.fetching ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        {ab && (
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {ab.referents?.legalReferents?.function && (
              <Section icon={<IconUsers className="h-3.5 w-3.5" />} title="Représentant légal">
                <Row label="Fonction" value={ab.referents.legalReferents.function} />
              </Section>
            )}

            {(ab.referents?.recruitmentReferents?.name || ab.referents?.recruitmentReferents?.email) && (
              <Section icon={<IconUsers className="h-3.5 w-3.5" />} title="Responsable recrutement">
                <Row label="Nom"      value={ab.referents.recruitmentReferents.name} />
                <Row label="Fonction" value={ab.referents.recruitmentReferents.function} />
                <Row label="Tél"      value={ab.referents.recruitmentReferents.phone} />
                <Row label="Email"    value={ab.referents.recruitmentReferents.email} />
              </Section>
            )}

            {(ab.companyInfos?.activities?.length > 0 || ab.companyInfos?.description || ab.administrationType) && (
              <Section icon={<IconJob className="h-3.5 w-3.5" />} title="Entreprise">
                {ab.companyInfos.activities?.length > 0 && (
                  <Row label="Secteurs" value={ab.companyInfos.activities.join(', ')} />
                )}
                <Row label="Description" value={ab.companyInfos.description} />
                <Row label="Administration" value={ab.administrationType ? ADMINISTRATION_LABELS[ab.administrationType as keyof typeof ADMINISTRATION_LABELS] ?? ab.administrationType : null} />
              </Section>
            )}

            <Section icon={<IconJob className="h-3.5 w-3.5" />} title="Poste">
              <Row label="Postes"              value={`${ab.positionsCount} poste${ab.positionsCount > 1 ? 's' : ''}`} />
              <Row label="Méthode recrutement" value={LABELS.recruitmentMethod[ab.recruitmentMethod]} />
              <Row label="Immersion"           value={LABELS.immersionPeriod[ab.immersionPeriod]} />
            </Section>

            {(ab.positions ?? []).map((p: any, i: number, arr: unknown[]) => {
              const c = p.criteria ?? {}
              return (
                <Section
                  key={i}
                  icon={<IconTaskList className="h-3.5 w-3.5" />}
                  title={arr.length > 1 ? `Poste ${i + 1}` : 'Détail du poste'}
                >
                  <Row label="Intitulé"     value={p.title} />
                  <Row label="Domaine"      value={LABELS.trainingDomain[p.trainingDomain]} />
                  <Row label="Localisation" value={(p.localisation ?? []).map(formatCommune).join(', ')} />
                  {p.missions?.length > 0 && (
                    <div className="py-2">
                      <ul className="list-disc list-inside space-y-0.5">
                        {p.missions.map((m: string) => (
                          <li key={m} className="text-sm text-[var(--ds-text)]">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(p.descriptionMissions?.length > 0 || p.otherDescriptionMissions) && (
                    <>
                      {p.descriptionMissions?.length > 0 && (
                        <Row label="Types de missions" value={p.descriptionMissions.join(', ')} />
                      )}
                      <Row label="Descriptif" value={p.otherDescriptionMissions} />
                    </>
                  )}
                  {c.educationLevel && (
                    <Row label="Niveau d'études" value={LABELS.educationLevel[c.educationLevel]} />
                  )}
                  <Row label="Permis B"   value={c.drivingLicense == null ? null : c.drivingLicense ? 'Oui' : 'Optionnel'} />
                  <div className="ml-3 pl-4 border-l-2 border-[var(--ds-border)]">
                    <Row label="Véhiculé"   value={c.hasVehicle == null ? null : c.hasVehicle ? 'Oui' : 'Non'} />
                  </div>
                  <Row label="Expérience" value={c.experienceRequired == null ? null : c.experienceRequired ? 'Expérience obligatoire' : 'Débutant accepté'} />
                  {(c.ageMin || c.ageMax) && (
                    <Row label="Âge" value={[c.ageMin ? `de ${c.ageMin} ans` : null, c.ageMax ? `à ${c.ageMax} ans` : null].filter(Boolean).join(' ')} />
                  )}
                  <Row label="Soft skills" value={c.softSkills} />
                  {formatScheduleSlots(c.scheduleOptions).length > 0 && (
                    <Row label="Horaires" value={formatScheduleSlots(c.scheduleOptions).join(', ')} />
                  )}
                  <Row label="Conditions" value={c.conditions} />
                  <Row label="Commentaires" value={c.additionalComments} />
                </Section>
              )
            })}

            {trainingDaysDisplay && (
              <Section icon={<IconCalendar className="h-3.5 w-3.5" />} title="Jours de formation">
                <div className="py-2 text-sm text-[var(--ds-text)]">{trainingDaysDisplay}</div>
              </Section>
            )}

            {ab.yousignSignatureRequestID && (
              <Section icon={<IconHash className="h-3.5 w-3.5" />} title="Signature électronique">
                <Row label="Référence" value={ab.yousignSignatureRequestID} />
              </Section>
            )}

            {ab.status === 'EN_ATTENTE_SIGNATURE' && (
              <Section icon={<IconBell className="h-3.5 w-3.5" />} title="Relance automatique">
                <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className={`text-sm font-medium ${ab.isRelanceDisabled ? 'text-[var(--ds-text-muted)]' : 'text-[var(--ds-success)]'}`}>
                      {ab.isRelanceDisabled ? 'Désactivée — aucun mail ne sera envoyé' : 'Activée — relance prévue 14 jours après envoi'}
                    </p>
                    <p className="text-xs text-[var(--ds-text-subtle)] leading-relaxed">
                      {ab.isRelanceDisabled
                        ? 'La relance est désactivée pour cette AB. L’AB et ses offres sont conservées.'
                        : 'Un mail de rappel sera envoyé automatiquement au responsable recrutement si l’AB n’est pas signée.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleRelance}
                    disabled={relanceResult.fetching}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 shrink-0 self-start sm:self-center ${ab.isRelanceDisabled ? 'border-[var(--ds-accent)] bg-[var(--ds-surface)] text-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)] focus-visible:ring-blue' : 'border-[var(--ds-warning)] bg-[var(--ds-surface)] text-[var(--ds-warning)] hover:bg-[var(--ds-warning-bg)] focus-visible:ring-amber-500'}`}
                  >
                    {ab.isRelanceDisabled ? <><IconBell className="h-3.5 w-3.5" />Réactiver relance</> : <><IconBellOff className="h-3.5 w-3.5" />Désactiver relance</>}
                  </button>
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
