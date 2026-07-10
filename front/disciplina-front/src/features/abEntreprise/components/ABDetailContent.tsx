import { Briefcase, Users, GraduationCap, ClipboardList, Calendar, Hash } from 'lucide-react'
import { formatTrainingDays } from '@/utils/trainingDays'

export const AB_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
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

const lbl = (map: Record<string, string>, v?: string | null) => (v ? map[v] ?? v : undefined)

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

interface AbPosition {
  trainingDomain?: string
  jobTitle?: string
  selectedMissions?: string[]
  localisation?: string
}

export interface AbDetail {
  legalRepFunction?: string | null
  recruitmentResponsibleName?: string | null
  recruitmentResponsibleFunction?: string | null
  recruitmentResponsiblePhone?: string | null
  recruitmentResponsibleEmail?: string | null
  companySectors?: string[]
  companyDescription?: string | null
  positionsCount?: number
  recruitmentMethod?: string
  immersionPeriod?: string
  positions?: AbPosition[]
  trainingDomain?: string
  jobTitle?: string
  selectedMissions?: string[]
  localisation?: string
  jobDescriptionMissions?: string[]
  jobDescriptionOther?: string | null
  otherMissions?: string | null
  conditions?: string | null
  scheduleOptions?: string[]
  additionalComments?: string | null
  educationLevel?: string
  drivingLicense?: string
  experienceRequired?: string
  ageRequirements?: string[]
  ageMin?: number | null
  ageMax?: number | null
  softSkills?: string | null
  trainingDays?: string
  yousignSignatureRequestID?: string | null
}

export function ABDetailContent({ ab }: { ab: AbDetail }) {
  const trainingDaysDisplay = formatTrainingDays(ab.trainingDays)
  const positions = ab.positions?.length
    ? ab.positions
    : [{ trainingDomain: ab.trainingDomain, jobTitle: ab.jobTitle, selectedMissions: ab.selectedMissions ?? [], localisation: ab.localisation }]

  return (
    <div className="space-y-5">
      {ab.legalRepFunction && (
        <Section icon={<Users className="h-3.5 w-3.5" />} title="Représentant légal">
          <Row label="Fonction" value={ab.legalRepFunction} />
        </Section>
      )}

      {(ab.recruitmentResponsibleName || ab.recruitmentResponsibleEmail) && (
        <Section icon={<Users className="h-3.5 w-3.5" />} title="Responsable recrutement">
          <Row label="Nom"      value={ab.recruitmentResponsibleName} />
          <Row label="Fonction" value={ab.recruitmentResponsibleFunction} />
          <Row label="Tél"      value={ab.recruitmentResponsiblePhone} />
          <Row label="Email"    value={ab.recruitmentResponsibleEmail} />
        </Section>
      )}

      {((ab.companySectors?.length ?? 0) > 0 || ab.companyDescription) && (
        <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Entreprise">
          {(ab.companySectors?.length ?? 0) > 0 && (
            <Row label="Secteurs" value={ab.companySectors!.join(', ')} />
          )}
          <Row label="Description" value={ab.companyDescription} />
        </Section>
      )}

      <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="Poste">
        <Row label="Postes"              value={ab.positionsCount ? `${ab.positionsCount} poste${ab.positionsCount > 1 ? 's' : ''}` : undefined} />
        <Row label="Méthode recrutement" value={lbl(LABELS.recruitmentMethod, ab.recruitmentMethod)} />
        <Row label="Immersion"           value={lbl(LABELS.immersionPeriod, ab.immersionPeriod)} />
      </Section>

      {positions.map((p, i, arr) => (
        <Section
          key={i}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          title={arr.length > 1 ? `Poste ${i + 1}` : 'Détail du poste'}
        >
          <Row label="Intitulé"     value={p.jobTitle} />
          <Row label="Domaine"      value={lbl(LABELS.trainingDomain, p.trainingDomain)} />
          <Row label="Localisation" value={lbl(LABELS.localisation, p.localisation)} />
          {(p.selectedMissions?.length ?? 0) > 0 && (
            <div className="py-2">
              <ul className="list-disc list-inside space-y-0.5">
                {p.selectedMissions!.map((m) => (
                  <li key={m} className="text-sm text-gray-900">{m}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      ))}

      {((ab.jobDescriptionMissions?.length ?? 0) > 0 || ab.jobDescriptionOther || ab.otherMissions) && (
        <Section icon={<ClipboardList className="h-3.5 w-3.5" />} title="Missions complémentaires">
          {(ab.jobDescriptionMissions?.length ?? 0) > 0 && (
            <Row label="Types" value={ab.jobDescriptionMissions!.join(', ')} />
          )}
          <Row label="Descriptif" value={ab.jobDescriptionOther} />
          <Row label="Autres missions" value={ab.otherMissions} />
        </Section>
      )}

      {(ab.conditions || (ab.scheduleOptions?.length ?? 0) > 0 || ab.additionalComments) && (
        <Section icon={<ClipboardList className="h-3.5 w-3.5" />} title="Conditions & commentaires">
          <Row label="Conditions" value={ab.conditions ?? ((ab.scheduleOptions?.length ?? 0) > 0 ? ab.scheduleOptions!.join(', ') : null)} />
          <Row label="Commentaires" value={ab.additionalComments} />
        </Section>
      )}

      <Section icon={<GraduationCap className="h-3.5 w-3.5" />} title="Profil apprenti">
        <Row label="Niveau d'études" value={lbl(LABELS.educationLevel, ab.educationLevel)} />
        <Row label="Permis B"        value={lbl(LABELS.drivingLicense, ab.drivingLicense)} />
        <Row label="Expérience"      value={lbl(LABELS.experienceRequired, ab.experienceRequired)} />
        {(ab.ageMin || ab.ageMax) ? (
          <Row label="Âge" value={[ab.ageMin ? `de ${ab.ageMin} ans` : null, ab.ageMax ? `à ${ab.ageMax} ans` : null].filter(Boolean).join(' ')} />
        ) : (ab.ageRequirements?.length ?? 0) > 0 && (
          <Row label="Âge" value={ab.ageRequirements!.join(', ')} />
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
          <Row label="Référence" value={ab.yousignSignatureRequestID} />
        </Section>
      )}
    </div>
  )
}
