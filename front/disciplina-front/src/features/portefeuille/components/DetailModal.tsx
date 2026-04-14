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
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { USERS } from '@/store/authStore'
import Button from '@/components/ui/Button'

const STATUS_CONFIG = {
  Oui: { bg: 'bg-success-bg', text: 'text-success', dot: 'bg-success' },
  Non: { bg: 'bg-danger-bg', text: 'text-danger', dot: 'bg-danger' },
  'À Réfléchir': { bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning' },
} as const

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onEdit: () => void
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

export default function DetailModal({ entreprise, currentUser, onClose, onEdit }: Props) {
  const status = STATUS_CONFIG[entreprise.status] ?? STATUS_CONFIG['Non']
  const owner = entreprise.proprietaire_id ? USERS[entreprise.proprietaire_id] : null

  const canEdit =
    currentUser.role === 'admin' ||
    currentUser.role === 'responsable' ||
    entreprise.proprietaire_id === currentUser.id

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
                          <span className="text-sm text-gray-900">{owner.name}</span>
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
    </div>
  )
}
