import { useState } from 'react'
import { X, Briefcase, Users, ClipboardList, Calendar, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNeedsAnalysis, useDeleteNeedsAnalysis } from '@/graphql/hooks'
import { formatCommune } from '@/data/reunionCommunes'
import { formatTrainingDays } from '@/utils/trainingDays'
import type { NeedsAnalysis, Position } from '@/types/needsAnalysis'

// Champs renvoyés par l'API mais absents du type Position partagé (structure historique divergente).
type PositionDisplay = Position & {
  missions?: string[] | null
  descriptionMissions?: string[] | null
  otherDescriptionMissions?: string | null
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  BROUILLON:            { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En attente de signature' },
  SIGNE:                { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Signé' },
  EXPIRE:               { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Expiré' },
}

const LABELS: Record<string, Record<string, string>> = {
  localisation:       { NORD: 'Nord', OUEST: 'Ouest', SUD: 'Sud' },
  trainingDomain:     { SECRETARIAT: 'Secrétariat', VENTE: 'Vente' },
  educationLevel:     { BAC: 'Bac', BAC_PLUS_2: 'Bac +2', BAC_PLUS_3: 'Bac +3' },
  recruitmentMethod:  { ALL_CV: 'Tous les CV', PRESELECTION: 'Présélection', PRE_INTERVIEW: 'Pré-entretien' },
  immersionPeriod:    { OUI: 'Oui', NON: 'Non', A_DISCUTER: 'À discuter' },
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
        {icon}{title}
      </p>
      <div className="bg-gray-50 rounded-xl px-4 py-1">
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ab = result.data?.needsAnalysis
  const badge = ab ? (STATUS_BADGE[ab.status] ?? STATUS_BADGE['BROUILLON']) : null
  const trainingDaysDisplay = formatTrainingDays(ab?.trainingDays)

  const handleDelete = async () => {
    await deleteNeedsAnalysis(id)
    onDelete?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-6 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            {result.fetching && <p className="text-sm text-gray-400">Chargement...</p>}
            {ab && (
              <>
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {ab.positions?.map((p: { title?: string }) => p.title).filter(Boolean).join(' / ') || 'Analyse du besoin'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {badge && (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  )}
                  {ab.createdAt && (
                    <span className="text-xs text-gray-400">
                      Créé le {format(new Date(ab.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ab && !confirmDelete && onEdit && (
              <button
                type="button"
                onClick={() => { onEdit(ab); onClose() }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue hover:text-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
              >
                Modifier
              </button>
            )}
            {ab && !confirmDelete && onDuplicate && (
              <button
                type="button"
                onClick={() => { onDuplicate(ab); onClose() }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue hover:text-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
              >
                Dupliquer
              </button>
            )}
            {ab && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="flex items-center justify-between gap-3 bg-red-50 px-6 py-3 border-b border-red-100">
            <p className="text-sm text-red-700 font-medium">Supprimer cette analyse du besoin ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteResult.fetching}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
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
              <Section icon={<Users className="h-3.5 w-3.5" />} title="Représentant légal">
                <Row label="Fonction" value={ab.referents.legalReferents.function} />
              </Section>
            )}

            {(ab.referents?.recruitmentReferents?.name || ab.referents?.recruitmentReferents?.email) && (
              <Section icon={<Users className="h-3.5 w-3.5" />} title="Responsable recrutement">
                <Row label="Nom"      value={ab.referents.recruitmentReferents.name} />
                <Row label="Fonction" value={ab.referents.recruitmentReferents.function} />
                <Row label="Tél"      value={ab.referents.recruitmentReferents.phone} />
                <Row label="Email"    value={ab.referents.recruitmentReferents.email} />
              </Section>
            )}

            {(ab.companyInfos?.activities?.length > 0 || ab.companyInfos?.description) && (
              <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Entreprise">
                {ab.companyInfos.activities?.length > 0 && (
                  <Row label="Secteurs" value={ab.companyInfos.activities.join(', ')} />
                )}
                <Row label="Description" value={ab.companyInfos.description} />
              </Section>
            )}

            <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Poste">
              <Row label="Postes"              value={`${ab.positionsCount} poste${ab.positionsCount > 1 ? 's' : ''}`} />
              <Row label="Méthode recrutement" value={LABELS.recruitmentMethod[ab.recruitmentMethod]} />
              <Row label="Immersion"           value={LABELS.immersionPeriod[ab.immersionPeriod]} />
            </Section>

            {(ab.positions ?? []).map((p: PositionDisplay, i: number, arr: unknown[]) => {
              const c = p.criteria ?? {}
              return (
                <Section
                  key={i}
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  title={arr.length > 1 ? `Poste ${i + 1}` : 'Détail du poste'}
                >
                  <Row label="Intitulé"     value={p.title} />
                  <Row label="Domaine"      value={p.trainingDomain ? LABELS.trainingDomain[p.trainingDomain] : undefined} />
                  <Row label="Localisation" value={(p.localisation ?? []).map(formatCommune).join(', ')} />
                  {p.missions && p.missions.length > 0 && (
                    <div className="py-2">
                      <ul className="list-disc list-inside space-y-0.5">
                        {p.missions.map((m: string) => (
                          <li key={m} className="text-sm text-gray-900">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {((p.descriptionMissions && p.descriptionMissions.length > 0) || p.otherDescriptionMissions) && (
                    <>
                      {p.descriptionMissions && p.descriptionMissions.length > 0 && (
                        <Row label="Types de missions" value={p.descriptionMissions.join(', ')} />
                      )}
                      <Row label="Descriptif" value={p.otherDescriptionMissions} />
                    </>
                  )}
                  {c.educationLevel && (
                    <Row label="Niveau d'études" value={LABELS.educationLevel[c.educationLevel]} />
                  )}
                  <Row label="Permis B"   value={c.drivingLicense == null ? null : c.drivingLicense ? 'Oui' : 'Optionnel'} />
                  <Row label="Expérience" value={c.experienceRequired == null ? null : c.experienceRequired ? 'Expérience obligatoire' : 'Débutant accepté'} />
                  {(c.ageMin || c.ageMax) && (
                    <Row label="Âge" value={[c.ageMin ? `de ${c.ageMin} ans` : null, c.ageMax ? `à ${c.ageMax} ans` : null].filter(Boolean).join(' ')} />
                  )}
                  <Row label="Soft skills" value={c.softSkills} />
                  <Row label="Conditions" value={c.conditions ?? (c.scheduleOptions && c.scheduleOptions.length > 0 ? c.scheduleOptions.join(', ') : null)} />
                  <Row label="Commentaires" value={c.additionalComments} />
                </Section>
              )
            })}

            {trainingDaysDisplay && (
              <Section icon={<Calendar className="h-3.5 w-3.5" />} title="Jours de formation">
                <div className="py-2 text-sm text-gray-900">{trainingDaysDisplay}</div>
              </Section>
            )}

            {ab.yousignSignatureRequestID && (
              <Section icon={<Hash className="h-3.5 w-3.5" />} title="Signature électronique">
                <Row label="Référence" value={ab.yousignSignatureRequestID} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
