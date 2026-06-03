import { X, Briefcase, Users, GraduationCap, ClipboardList, Calendar, Hash } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNeedsAnalysis } from '@/graphql/hooks'

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
  drivingLicense:     { OUI: 'Oui', OPTIONNEL: 'Optionnel' },
  experienceRequired: { DEBUTANT: 'Débutant accepté', OBLIGATOIRE: 'Expérience obligatoire' },
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
  id: number
  onClose: () => void
}

export default function ABDetailModal({ id, onClose }: Props) {
  const result = useNeedsAnalysis(id)
  const ab = result.data?.needsAnalysis
  const badge = ab ? (STATUS_BADGE[ab.status] ?? STATUS_BADGE['BROUILLON']) : null

  let trainingDaysDisplay: string | null = null
  if (ab?.trainingDays) {
    try {
      const days = JSON.parse(ab.trainingDays)
      const DAY_LABELS: Record<string, string> = {
        monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
        thursday: 'Jeudi', friday: 'Vendredi',
      }
      const STATUS_LABELS: Record<string, string> = { OUI: '✓', NON: '✗', PREFERE: '~' }
      trainingDaysDisplay = Object.entries(days)
        .map(([k, v]) => `${DAY_LABELS[k] ?? k}: ${STATUS_LABELS[v as string] ?? v}`)
        .join('  •  ')
    } catch {
      trainingDaysDisplay = ab.trainingDays
    }
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
                <h2 className="text-lg font-bold text-gray-900 truncate">{ab.jobTitle}</h2>
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
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {ab && (
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {(ab.recruitmentResponsibleName || ab.recruitmentResponsibleEmail) && (
              <Section icon={<Users className="h-3.5 w-3.5" />} title="Responsable recrutement">
                <Row label="Nom"       value={ab.recruitmentResponsibleName} />
                <Row label="Téléphone" value={ab.recruitmentResponsiblePhone} />
                <Row label="Email"     value={ab.recruitmentResponsibleEmail} />
              </Section>
            )}

            <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Poste">
              <Row label="Intitulé"            value={ab.jobTitle} />
              <Row label="Postes"              value={`${ab.positionsCount} poste${ab.positionsCount > 1 ? 's' : ''}`} />
              <Row label="Localisation"        value={LABELS.localisation[ab.localisation]} />
              <Row label="Domaine"             value={LABELS.trainingDomain[ab.trainingDomain]} />
              <Row label="Méthode recrutement" value={LABELS.recruitmentMethod[ab.recruitmentMethod]} />
              <Row label="Immersion"           value={LABELS.immersionPeriod[ab.immersionPeriod]} />
            </Section>

            {(ab.selectedMissions?.length > 0 || ab.otherMissions) && (
              <Section icon={<ClipboardList className="h-3.5 w-3.5" />} title="Missions">
                {ab.selectedMissions?.length > 0 && (
                  <div className="py-2">
                    <ul className="list-disc list-inside space-y-0.5">
                      {ab.selectedMissions.map((m: string) => (
                        <li key={m} className="text-sm text-gray-900">{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Row label="Autres" value={ab.otherMissions} />
              </Section>
            )}

            <Section icon={<GraduationCap className="h-3.5 w-3.5" />} title="Profil apprenti">
              <Row label="Niveau d'études" value={LABELS.educationLevel[ab.educationLevel]} />
              <Row label="Permis B"        value={LABELS.drivingLicense[ab.drivingLicense]} />
              <Row label="Expérience"      value={LABELS.experienceRequired[ab.experienceRequired]} />
              {ab.ageRequirements?.length > 0 && (
                <Row label="Âge"           value={ab.ageRequirements.join(', ')} />
              )}
              <Row label="Soft skills"     value={ab.softSkills} />
            </Section>

            {trainingDaysDisplay && (
              <Section icon={<Calendar className="h-3.5 w-3.5" />} title="Jours de formation">
                <div className="py-2 text-sm text-gray-900">{trainingDaysDisplay}</div>
              </Section>
            )}

            {ab.yousignSignatureRequestID && (
              <Section icon={<Hash className="h-3.5 w-3.5" />} title="Signature électronique">
                <Row label="ID Yousign" value={ab.yousignSignatureRequestID} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
