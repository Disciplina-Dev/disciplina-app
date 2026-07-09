import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Hash,
  FileText,
  User,
  Calendar,
  Bell,
  UserCheck,
  Pencil,
  Copy,
  Check,
  ClipboardList,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { USERS, fullName } from '@/store/authStore'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import { useNeedsAnalysesByCompany, useDeleteNeedsAnalysis } from '@/graphql/hooks'
import ABDetailModal from '@/features/abEntreprise/components/ABDetailModal'
import RelanceHistorySection from '@/features/portefeuille/components/RelanceHistorySection'

const STATUS_CONFIG = {
  Oui: { bg: 'bg-success-bg', text: 'text-success', dot: 'bg-success' },
  Non: { bg: 'bg-danger-bg', text: 'text-danger', dot: 'bg-danger' },
  'À Réfléchir': { bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning' },
  Relance: { bg: 'bg-blue/10', text: 'text-blue', dot: 'bg-blue' },
  'Réponds pas': { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  Fermé: { bg: 'bg-gray-200', text: 'text-gray-700', dot: 'bg-gray-700' },
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
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm text-gray-900 break-words">{value}</p>
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
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-gray-900 break-all">{value}</p>
          <button
            onClick={copy}
            title="Copier"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-blue-light hover:text-blue"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
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
  BROUILLON:             { bg: 'bg-gray-100',    text: 'text-gray-600',  label: 'Brouillon' },
  EN_ATTENTE_SIGNATURE:  { bg: 'bg-yellow-100',  text: 'text-yellow-700', label: 'En attente de signature' },
  SIGNE:                 { bg: 'bg-green-100',   text: 'text-green-700', label: 'Signé' },
  EXPIRE:                { bg: 'bg-red-100',     text: 'text-red-600',   label: 'Expiré' },
}

export default function DetailModal({ entreprise, currentUser, onClose, onEdit, onCreateAB }: Props) {
  const status = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const owner = entreprise.proprietaire_id ? USERS[entreprise.proprietaire_id] : null
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
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-light">
              <Building2 className="h-5 w-5 text-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
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
                  <span className="text-xs text-gray-500">{entreprise.secteur}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Mail className="h-3.5 w-3.5" />}
                onClick={() => setMailOpen(true)}
              >
                Envoyer un mail
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<FileText className="h-3.5 w-3.5" />}
                onClick={onCreateAB}
              >
                Créer une Analyse (AB)
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={onEdit}
                >
                  Modifier
                </Button>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Left column */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Informations générales</p>
              <Field icon={<Hash className="h-4 w-4" />} label="SIRET" value={entreprise.siret} />
              <Field icon={<Briefcase className="h-4 w-4" />} label="Métier / Description" value={entreprise.metier} />
              <Field icon={<MapPin className="h-4 w-4" />} label="Adresse" value={entreprise.adresse} />
              <Field icon={<Hash className="h-4 w-4" />} label="IDCC" value={entreprise.idcc} />
              <Field icon={<User className="h-4 w-4" />} label="Représentant légal" value={entreprise.representant_legal} />
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Contact</p>
              <Field icon={<Phone className="h-4 w-4" />} label="Téléphone" value={entreprise.telephone} />
              <CopyableField icon={<Mail className="h-4 w-4" />} label="Adresse e-mail" value={entreprise.email} />

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Suivi commercial</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300">
                      <UserCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Propriétaire</p>
                      {owner ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold"
                            style={{ backgroundColor: owner.color }}
                          >
                            {owner.initials}
                          </span>
                          <span className="text-sm text-gray-900">{fullName(owner)}</span>
                          <span className="text-xs text-gray-500">({owner.role})</span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300 italic mt-0.5">Non attribué</p>
                      )}
                    </div>
                  </div>
                  <Field
                    icon={<Calendar className="h-4 w-4" />}
                    label="Date d'insertion"
                    value={formatDate(entreprise.date_insertion)}
                  />
                  <Field
                    icon={<Bell className="h-4 w-4" />}
                    label="Date de relance"
                    value={formatDate(entreprise.date_relance)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AB History */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Analyses du besoin
              </p>
              {selectedAbIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer ({selectedAbIds.size})
                </button>
              )}
            </div>
            {abResult.fetching && (
              <p className="text-sm text-gray-400 italic">Chargement...</p>
            )}
            {!abResult.fetching && abList.length === 0 && (
              <p className="text-sm text-gray-400 italic">Aucune analyse du besoin pour cette entreprise.</p>
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
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-blue-50',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(ab.id)}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 accent-blue cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate">{ab.jobTitle}</span>
                        <span className="ml-2 text-xs text-gray-400">{ab.positionsCount} poste{ab.positionsCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ab.createdAt && (
                          <span className="text-xs text-gray-400">{formatDate(ab.createdAt)}</span>
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
            <div className="mt-5 pt-5 border-t border-gray-100">
              <RelanceHistorySection companyId={Number(entreprise.id)} />
            </div>
          )}

          {/* Notes section */}
          {(entreprise.note || entreprise.conclusion) && (
            <div className="mt-5 space-y-3 pt-5 border-t border-gray-100">
              {entreprise.note && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    <FileText className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Note
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                    {entreprise.note}
                  </p>
                </div>
              )}
              {entreprise.conclusion && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    <FileText className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Conclusion
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
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
