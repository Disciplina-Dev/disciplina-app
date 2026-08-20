import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import {
  X, Check, Briefcase, Plus, Minus, PenLine, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { apiFetch } from '@/api/httpClient'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { useCreateNeedsAnalysis, useUpdateNeedsAnalysis, useUpdateCompany } from '@/graphql/hooks'
import { Localisation } from '@/types/candidate'
import type { NeedsAnalysis, ScheduleSlot } from '@/types/needsAnalysis'
import { formatCommune } from '@/data/reunionCommunes'
import { ALL_SECTORS, SECTOR_LABELS } from '@/data/sectors'
import SignaturePreviewModal from './SignaturePreviewModal'

// ─── Types ────────────────────────────────────────────────────────────────────

const COMMUNES = Object.values(Localisation)

type DayStatus = 'OUI' | 'NON' | 'PREFERE'
type TrainingDomain = 'SECRETARIAT' | 'VENTE'
type Opco =
  | 'AKTO'
  | 'ATLAS'
  | 'AFDAS'
  | 'CONSTRUCTYS'
  | 'OCAPIAT'
  | 'OPCO_2I'
  | 'OPCO_EP'
  | 'OPCO_MOBILITES'
  | 'OPCO_SANTE'
  | 'OPCOMMERCE'
  | 'UNIFORMATION'

interface TrainingDaysState {
  monday: DayStatus
  tuesday: DayStatus
  wednesday: DayStatus
  thursday: DayStatus
  friday: DayStatus
}

interface PosteCriteria {
  drivingLicense: 'OUI' | 'OPTIONNEL' | undefined
  experienceRequired: 'DEBUTANT' | 'OBLIGATOIRE' | undefined
  ageMin: string
  ageMax: string
  softSkills: string[]
  softSkillsOther: string
  scheduleOptions: ScheduleSlot[]
  conditions: string
  additionalComments: string
}

interface PosteTp {
  jobTitle: string
  selectedMissions: string[]
  otherDescriptionMissions: string
}

interface Poste {
  jobRole: string
  count: number
  trainingDomain: TrainingDomain | undefined
  desiredTp: PosteTp[]
  localisation: Localisation[]
  criteria: PosteCriteria
}

interface FormData {
  companyName: string
  companySiret: string
  companyAddress: string
  companyPostalCode: string
  companyCommune: string
  legalRepName: string
  legalRepFunction: string
  legalRepFunctionOther: string
  legalRepPhone: string
  legalRepEmail: string
  isDifferentRecruitmentResponsible: boolean
  recruitmentResponsibleName: string
  recruitmentResponsibleFunction: string
  recruitmentResponsibleFunctionOther: string
  recruitmentResponsiblePhone: string
  recruitmentResponsibleEmail: string
  companySectors: string[]
  opco: Opco | undefined
  companySectorOther: string
  companyDescriptionOther: string
  recruitmentMethod: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW'
  immersionPeriod: 'OUI' | 'NON' | 'A_DISCUTER'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONCTIONS = [
  'Directeur(trice) Général(e)',
  'PDG',
  'Gérant(e)',
  'Directeur(trice) des Ressources Humaines',
  'Responsable Recrutement',
  'Directeur(trice) Commercial(e)',
  'Responsable Administratif(ve)',
  'Directeur(trice) Financier(ère)',
  'Chef(fe) d\'entreprise',
  'Autre',
]

const SECTEURS = ALL_SECTORS

const OPCO_OPTIONS: { value: Opco; label: string }[] = [
  { value: 'AKTO', label: 'AKTO' },
  { value: 'ATLAS', label: 'ATLAS' },
  { value: 'AFDAS', label: 'Afdas' },
  { value: 'CONSTRUCTYS', label: 'Constructys' },
  { value: 'OCAPIAT', label: 'OCAPIAT' },
  { value: 'OPCO_2I', label: 'Opco 2i' },
  { value: 'OPCO_EP', label: 'Opco EP' },
  { value: 'OPCO_MOBILITES', label: 'Opco Mobilités' },
  { value: 'OPCO_SANTE', label: 'Opco Santé' },
  { value: 'OPCOMMERCE', label: "L'Opcommerce" },
  { value: 'UNIFORMATION', label: 'Uniformation' },
]

const JOB_TITLES_BY_DOMAIN: Record<TrainingDomain, string[]> = {
  SECRETARIAT: ['Secrétaire Assistante', 'Assistante de Direction'],
  VENTE: ['Conseiller Commercial', 'Négociateur Technico-Commercial', "Responsable d'Établissement Marchand"],
}

// Chaque intitulé de formation correspond à un titre professionnel (TP).
const TITLE_TO_TP: Record<string, string> = {
  'Secrétaire Assistante': 'SA',
  'Assistante de Direction': 'AD',
  'Conseiller Commercial': 'CC',
  'Négociateur Technico-Commercial': 'NTC',
  "Responsable d'Établissement Marchand": 'REM',
}

const TP_TO_TITLE: Record<string, string> = Object.fromEntries(
  Object.entries(TITLE_TO_TP).map(([title, tp]) => [tp, title]),
)

const SOFT_SKILLS_LIST = [
  'Rigueur et organisation',
  'Sens du service client',
  'Esprit d\'équipe',
  'Autonomie',
  'Adaptabilité',
  'Maîtrise des outils bureautiques',
  'Bon relationnel',
  'Dynamisme et motivation',
  'Discrétion et confidentialité',
  'Sens commercial',
  'Proactivité',
  'Gestion du stress',
  'Ponctualité et fiabilité',
  'Capacité d\'apprentissage',
  'Sens des responsabilités',
]

const MISSIONS: Record<TrainingDomain, Record<string, string[]>> = {
  SECRETARIAT: {
    'Secrétaire Assistante': [
      'Accueil physique et téléphonique',
      'Gestion du courrier entrant et sortant',
      'Rédaction et mise en forme de courriers simples',
      'Prise de rendez-vous',
      'Préparation logistique des réunions',
      'Classement et archivage',
      'Saisie de données',
      'Communication interne/externe',
      'Gestion administrative générale',
    ],
    'Assistante de Direction': [
      'Accueil physique et téléphonique',
      'Gestion du courrier',
      'Rédaction de courriers/e-mails complexes',
      'Organisation de l\'agenda',
      'Prise de rendez-vous',
      'Organisation de réunions stratégiques',
      'Classement et gestion documentaire',
      'Communication interne/externe',
      'Suivi de dossiers confidentiels',
      'Utilisation avancée des outils bureautiques',
      'Réalisation de synthèses/reporting',
      'Suivi de projets',
      'Gestion administrative générale',
    ],
  },
  VENTE: {
    'Conseiller Commercial': [
      'Accueil client (physique/téléphonique/digital)',
      'Identifier les besoins',
      'Présenter les produits/services',
      'Conseiller le client',
      'Argumenter/répondre aux objections',
      'Réaliser des ventes',
      'Élaborer des devis',
      'Mettre en place des actions de prospection',
      'Participer aux actions de fidélisation',
      'Suivre ses ventes et objectifs',
      'Organiser l\'espace de vente',
      'Participer aux actions promotionnelles',
      'Suivre les stocks',
      'Respecter les règles d\'hygiène/sécurité',
      'Contribuer à la valorisation de l\'image',
    ],
    'Négociateur Technico-Commercial': [
      'Accueil et orientation client',
      'Rechercher des informations clients/marchés',
      'Identifier de nouveaux prospects',
      'Planifier des rendez-vous',
      'Réaliser des entretiens BtoB',
      'Élaborer des offres chiffrées',
      'Négocier les conditions',
      'Conclure les ventes',
      'Assurer le suivi après vente',
      'Développer la relation de confiance',
      'Participer au plan d\'actions commerciales',
      'Suivre ses résultats',
      'Coordonner avec les équipes techniques',
      'Respecter la politique commerciale',
    ],
    'Responsable d\'Établissement Marchand': [
      'Accueil/information client',
      'Vente/négociation',
      'Élaboration de devis',
      'Suivi/fidélisation',
      'Analyse des besoins et suivi des objectifs',
      'Mise en œuvre d\'actions commerciales',
      'Organisation de l\'espace de vente',
      'Coordination des équipes',
      'Encadrement et animation d\'équipe',
      'Ouverture/fermeture du point de vente',
      'Analyse des indicateurs de performance',
      'Suivi budgétaire',
      'Gestion administrative de l\'établissement',
      'Communication interne/externe',
      'Respect des règles d\'hygiène/sécurité',
    ],
  },
}

const DAYS: { key: keyof TrainingDaysState; label: string }[] = [
  { key: 'monday',    label: 'Lundi' },
  { key: 'tuesday',   label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday',  label: 'Jeudi' },
  { key: 'friday',    label: 'Vendredi' },
]

const EMPTY_POSTE: Poste = {
  jobRole: '',
  count: 1,
  trainingDomain: undefined,
  desiredTp: [],
  localisation: [],
  criteria: {
    drivingLicense: undefined,
    experienceRequired: undefined,
    ageMin: '',
    ageMax: '',
    softSkills: [],
    softSkillsOther: '',
    scheduleOptions: [],
    conditions: '',
    additionalComments: '',
  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TpMissionsFields({ domain, tp, onChangeMissions, onChangeOther }: {
  domain: TrainingDomain
  tp: PosteTp
  onChangeMissions: (missions: string[]) => void
  onChangeOther: (value: string) => void
}) {
  const options = MISSIONS[domain]?.[tp.jobTitle] ?? []
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-gray-100 p-3">
      <p className="text-sm font-semibold text-gray-900">{tp.jobTitle}</p>
      {options.length > 0 && (
        <CheckboxGroup
          label={`Missions à confier à l'apprenti — ${tp.jobTitle}`}
          options={options}
          selected={tp.selectedMissions}
          onChange={onChangeMissions}
          columns={2}
        />
      )}
      {tp.selectedMissions.length > 0 && (
        <p className="text-xs text-blue">
          {tp.selectedMissions.length} mission{tp.selectedMissions.length > 1 ? 's' : ''} sélectionnée{tp.selectedMissions.length > 1 ? 's' : ''}
        </p>
      )}
      <TextareaField id={`jobDescriptionOther-${tp.jobTitle}`} label="Description complémentaire" optional rows={3}
        placeholder="Responsabilités spécifiques, contexte…"
        value={tp.otherDescriptionMissions}
        onChange={(e) => onChangeOther(e.target.value)} />
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-gray-100 pb-2 text-base font-bold text-gray-900">
      {children}
    </h3>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-danger">{message}</p>
}

function SelectField({
  id, label, options, error, required, placeholder, ...props
}: {
  id: string
  label: string
  options: string[]
  error?: string
  required?: boolean
  placeholder?: string
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-1 text-danger">*</span>}
      </label>
      <select
        id={id}
        className={[
          'w-full rounded-[10px] border bg-white py-2.5 pl-4 pr-4 text-sm text-gray-900',
          'outline-none transition-colors appearance-none cursor-pointer',
          error ? 'border-danger' : 'border-gray-100',
          'focus:border-blue',
        ].join(' ')}
        {...props}
      >
        <option value="">{placeholder ?? 'Sélectionner…'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  )
}

function QuantityStepper({
  value, onChange, min = 1, max = 99,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-100 bg-white text-gray-700 transition-colors hover:border-blue hover:text-blue disabled:opacity-40"
      >
        <Minus size={14} />
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-bold text-gray-900">×{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-100 bg-white text-gray-700 transition-colors hover:border-blue hover:text-blue disabled:opacity-40"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function RadioGroup<T extends string>({
  label, options, value, onChange, error, required,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
  error?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-1 text-danger">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              value === opt.value
                ? 'border-blue bg-blue-light text-blue'
                : 'border-gray-100 bg-white text-gray-700 hover:border-blue-light',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  )
}

function CheckboxGroup({
  label, options, selected, onChange, columns = 2, renderLabel,
}: {
  label?: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  columns?: 1 | 2 | 3
  renderLabel?: (value: string) => string
}) {
  const toggle = (val: string) =>
    selected.includes(val)
      ? onChange(selected.filter((v) => v !== val))
      : onChange([...selected, val])

  const colClass = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }[columns]

  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      <div className={`grid gap-2 ${colClass}`}>
        {options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={[
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                checked
                  ? 'border-blue bg-blue-light text-blue'
                  : 'border-gray-100 bg-white text-gray-700 hover:border-blue-light',
              ].join(' ')}
            >
              <span className={[
                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                checked ? 'border-blue bg-blue' : 'border-gray-300 bg-white',
              ].join(' ')}>
                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
              </span>
              {renderLabel ? renderLabel(opt) : opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextareaField({
  id, label, optional, ...props
}: {
  id: string
  label: string
  optional?: boolean
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label} {optional && <span className="text-gray-400">(optionnel)</span>}
      </label>
      <textarea id={id}
        className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue"
        {...props} />
    </div>
  )
}

// Sélecteur de jours et horaires de travail du poste : chaque jour est activable
// et porte un créneau début/fin facultatif. Seuls les jours activés sont persistés.
function ScheduleDaysEditor({ value, onChange }: {
  value: ScheduleSlot[]
  onChange: (slots: ScheduleSlot[]) => void
}) {
  const slotFor = (label: string) => value.find((s) => s.day === label)
  const setHour = (label: string, field: 'startHour' | 'endHour', hour: string) => {
    onChange(value.map((s) => (s.day === label ? { ...s, [field]: hour } : s)))
  }

  const timeInput = (
    field: 'startHour' | 'endHour',
    label: string,
    enabled: boolean,
    hour?: string | null,
  ) => (
    <input
      type="time"
      disabled={!enabled}
      value={hour ?? ''}
      onChange={(e) => setHour(label, field, e.target.value)}
      className="w-32 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">
        Jours et horaires de travail <span className="text-gray-400">(optionnel)</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-40 px-4 py-2.5 text-left font-medium text-gray-500">Jour</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Début</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Fin</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const slot = slotFor(d.label)
              const enabled = !!slot
              const setEnabled = (on: boolean) => {
                const others = value.filter((s) => s.day !== d.label)
                onChange(on ? [...others, { day: d.label, startHour: '08:00', endHour: '17:00' }] : others)
              }
              return (
                <tr key={d.key} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <label className="flex cursor-pointer items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={[
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
                          enabled ? 'border-blue bg-blue' : 'border-gray-300 bg-white',
                        ].join(' ')}
                        aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${d.label}`}
                      >
                        {enabled && <Check size={12} className="text-white" strokeWidth={3} />}
                      </button>
                      <span className={enabled ? 'text-sm font-medium text-gray-900' : 'text-sm text-gray-400'}>
                        {d.label}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-2.5">{timeInput('startHour', d.label, enabled, slot?.startHour)}</td>
                  <td className="px-3 py-2.5">{timeInput('endHour', d.label, enabled, slot?.endHour)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onSuccess: (needsAnalysisId: string) => void
  initialData?: NeedsAnalysis | null
  // Duplication : `initialData` sert uniquement à préremplir le formulaire, mais on
  // crée une NOUVELLE AB (pas de mise à jour de l'existante).
  isDuplicate?: boolean
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NeedsAnalysisModal({ entreprise, currentUser, onClose, onSuccess, initialData, isDuplicate }: Props) {
  const parseSoftSkills = (raw: string | null | undefined): string[] => {
    if (!raw) return []
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const parseTrainingDays = (raw: string | null | undefined): TrainingDaysState => {
    const defaults: TrainingDaysState = { monday: 'OUI', tuesday: 'OUI', wednesday: 'OUI', thursday: 'OUI', friday: 'OUI' }
    if (!raw) return defaults
    try {
      const days: Record<string, string[]> = JSON.parse(raw)
      const mapPeriod = (periods: string[]): DayStatus => {
        if (periods.includes('PREFERE')) return 'PREFERE'
        if (periods.length === 0) return 'NON'
        return 'OUI'
      }
      return {
        monday:    mapPeriod(days.monday ?? []),
        tuesday:   mapPeriod(days.tuesday ?? []),
        wednesday: mapPeriod(days.wednesday ?? []),
        thursday:  mapPeriod(days.thursday ?? []),
        friday:    mapPeriod(days.friday ?? []),
      }
    } catch {
      return defaults
    }
  }

  const [trainingDays, setTrainingDays] = useState<TrainingDaysState>(
    parseTrainingDays(initialData?.trainingDays)
  )
  const [postes, setPostes] = useState<Poste[]>(() => {
    if (initialData?.positions && initialData.positions.length > 0) {
      return initialData.positions.map((p) => ({
        jobRole: p.jobRole ?? '',
        count: p.count ?? 1,
        trainingDomain: p.trainingDomain as TrainingDomain | undefined,
        desiredTp: (p.desiredTp ?? []).map((tp) => ({
          jobTitle: tp.tpType ? TP_TO_TITLE[tp.tpType] ?? '' : '',
          selectedMissions: tp.missions ?? [],
          otherDescriptionMissions: tp.otherDescriptionMissions ?? '',
        })),
        localisation: (p.localisation ?? []) as Localisation[],
        criteria: {
          drivingLicense: p.criteria?.drivingLicense == null ? undefined : p.criteria.drivingLicense ? 'OUI' : 'OPTIONNEL',
          experienceRequired: p.criteria?.experienceRequired == null ? undefined : p.criteria.experienceRequired ? 'OBLIGATOIRE' : 'DEBUTANT',
          ageMin: p.criteria?.ageMin != null ? String(p.criteria.ageMin) : '',
          ageMax: p.criteria?.ageMax != null ? String(p.criteria.ageMax) : '',
          softSkills: parseSoftSkills(p.criteria?.softSkills),
          softSkillsOther: '',
          scheduleOptions: p.criteria?.scheduleOptions ?? [],
          conditions: p.criteria?.conditions ?? '',
          additionalComments: p.criteria?.additionalComments ?? '',
        },
      }))
    }
    return [{ ...EMPTY_POSTE }]
  })
  // Un poste existant (édition/duplication) démarre replié ; un poste unique neuf, déplié.
  const [collapsed, setCollapsed] = useState<boolean[]>(() =>
    postes.length > 1 ? postes.map(() => true) : [false]
  )
  const [posteErrors, setPosteErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  // Quelle action a déclenché la soumission : enregistrer seul, télécharger le PDF
  // ou envoyer en signature.
  const intentRef = useRef<'download' | 'sign' | 'save'>('download')

  // En duplication, on préremplit avec `initialData` mais on reste en mode création.
  const isEditing = !!initialData && !isDuplicate
  const { createNeedsAnalysis, result: createResult } = useCreateNeedsAnalysis()
  const { updateNeedsAnalysis: updateMutation, result: updateResult } = useUpdateNeedsAnalysis()
  const result = isEditing ? updateResult : createResult
  const { update: updateCompany } = useUpdateCompany()

  const initialReferents = initialData?.referents
  const initialCompanyInfos = initialData?.companyInfos

  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      companyName:        entreprise.nom_commercial ?? '',
      companySiret:       entreprise.siret ?? '',
      companyAddress:     entreprise.adresse ?? '',
      companyPostalCode:  initialCompanyInfos?.postalCode ?? '',
      companyCommune:     initialCompanyInfos?.commune ?? '',
      legalRepName:       entreprise.representant_legal ?? '',
      legalRepFunction:   initialReferents?.legalReferents?.function ?? '',
      legalRepFunctionOther: '',
      legalRepPhone:      entreprise.telephone ?? '',
      legalRepEmail:      entreprise.email ?? '',
      isDifferentRecruitmentResponsible: !!(initialReferents?.recruitmentReferents?.name && initialReferents.recruitmentReferents.name !== entreprise.representant_legal),
      recruitmentResponsibleName:     initialReferents?.recruitmentReferents?.name ?? '',
      recruitmentResponsibleFunction: initialReferents?.recruitmentReferents?.function ?? '',
      recruitmentResponsibleFunctionOther: '',
      recruitmentResponsiblePhone:    initialReferents?.recruitmentReferents?.phone ?? '',
      recruitmentResponsibleEmail:    initialReferents?.recruitmentReferents?.email ?? '',
      companySectors:           initialCompanyInfos?.activities ?? [],
      companySectorOther:       '',
      opco:                     (initialCompanyInfos?.opco as Opco | undefined) ?? undefined,
      companyDescriptionOther:  initialCompanyInfos?.description ?? '',
      recruitmentMethod:  (initialData?.recruitmentMethod as 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW' | undefined) ?? undefined,
      immersionPeriod:    (initialData?.immersionPeriod as 'OUI' | 'NON' | 'A_DISCUTER' | undefined) ?? undefined,
    },
  })

  useEffect(() => {
    if (entreprise.adresse) {
      setValue('companyAddress', entreprise.adresse)
    }
  }, [entreprise.adresse, setValue])

  const isDifferentResponsible = watch('isDifferentRecruitmentResponsible')
  const legalRepFunction       = watch('legalRepFunction')
  const responsibleFunction    = watch('recruitmentResponsibleFunction')
  const companySectors         = watch('companySectors') ?? []
  const companyPostalCode      = watch('companyPostalCode')

  // Secteurs libres (saisis via « Autre secteur d'activité ») déjà enregistrés sur
  // l'AB : ils ne figurent pas dans la liste de cases à cocher et doivent pouvoir
  // être retirés, sinon ils resteraient invisiblement attachés à l'AB.
  const customSectors = companySectors.filter((s) => !SECTEURS.includes(s as (typeof SECTEURS)[number]))

  const removeCustomSector = (sector: string) => {
    setValue('companySectors', companySectors.filter((s) => s !== sector))
  }

  // Code postal valide (5 chiffres) → renseigne automatiquement la commune via
  // l'API geo.gouv (gratuite, sans clé). Un CP peut couvrir plusieurs communes :
  // on prend la première. Annulé si le composant se démonte / le CP change.
  useEffect(() => {
    if (!/^\d{5}$/.test(companyPostalCode ?? '')) return
    const controller = new AbortController()
    fetch(`https://geo.api.gouv.fr/communes?codePostal=${companyPostalCode}&fields=nom&format=json`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`geo.api.gouv ${res.status}`))))
      .then((communes: { nom: string }[]) => {
        if (communes?.[0]?.nom) {
          setValue('companyCommune', communes[0].nom, { shouldValidate: true, shouldDirty: true })
        }
      })
      .catch(() => { /* réseau / abort : on laisse l'utilisateur saisir la commune à la main */ })
    return () => controller.abort()
  }, [companyPostalCode, setValue])

  // ─── Postes ──────────────────────────────────────────────────────────────────

  const addPoste = () => {
    setPostes((prev) => [...prev, { ...EMPTY_POSTE }])
    setCollapsed((prev) => [...prev, false])
  }

  const removePoste = (index: number) => {
    setPostes((prev) => prev.filter((_, i) => i !== index))
    setCollapsed((prev) => prev.filter((_, i) => i !== index))
    setPosteErrors((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleCollapsed = (index: number) => {
    setCollapsed((prev) => prev.map((c, i) => (i === index ? !c : c)))
  }

  const updatePoste = (index: number, patch: Partial<Poste>) => {
    setPostes((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  // Réconcilie les TP d'un poste avec les intitulés cochés : conserve les missions
  // déjà saisies pour un TP maintenu, initialise une entrée vide pour un TP ajouté.
  const setPosteTitles = (index: number, titles: string[]) => {
    setPostes((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p
        const desiredTp = titles.map(
          (jobTitle) =>
            p.desiredTp.find((tp) => tp.jobTitle === jobTitle) ?? {
              jobTitle,
              selectedMissions: [],
              otherDescriptionMissions: '',
            },
        )
        return { ...p, desiredTp }
      }),
    )
  }

  const updatePosteTp = (index: number, tpIndex: number, patch: Partial<PosteTp>) => {
    setPostes((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, desiredTp: p.desiredTp.map((tp, j) => (j === tpIndex ? { ...tp, ...patch } : tp)) } : p,
      ),
    )
  }

  const validatePostes = (): boolean => {
    const errs = postes.map((p) => {
      if (!p.jobRole.trim()) return 'Renseignez l\'intitulé de métier.'
      if (!p.trainingDomain) return 'Sélectionnez le domaine de formation.'
      if (p.desiredTp.length === 0) return 'Sélectionnez au moins un titre professionnel.'
      if (p.desiredTp.some((tp) => tp.selectedMissions.length === 0))
        return 'Sélectionnez au moins une mission par titre professionnel.'
      if (p.localisation.length === 0) return 'Sélectionnez au moins une commune.'
      if (!p.criteria.drivingLicense) return 'Sélectionnez le permis requis.'
      if (!p.criteria.experienceRequired) return "Sélectionnez l'expérience requise."
      return ''
    })
    setPosteErrors(errs)
    setCollapsed((prev) => prev.map((c, i) => (errs[i] ? false : c)))
    return errs.every((e) => !e)
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    console.log('[NeedsAnalysisModal] onSubmit triggered', { isEditing, initialDataId: initialData?.id })
    setSubmitError(null)

    if (!validatePostes()) {
      setSubmitError('Veuillez compléter tous les postes.')
      return
    }

    try {
    // L'identité de l'entreprise (raison sociale, SIRET, adresse, représentant
    // légal) vit dans la table `companies` — le PDF de l'AB est généré côté
    // serveur à partir de cet enregistrement, pas du formulaire. On persiste donc
    // les éventuelles corrections saisies ici AVANT de générer/envoyer l'AB, sinon
    // elles seraient perdues. Code postal + commune n'ont pas de colonne dédiée :
    // on les compose dans l'adresse (sans dupliquer si déjà présents).
    const street = data.companyAddress?.trim() ?? ''
    const cpCommune = [data.companyPostalCode?.trim(), data.companyCommune?.trim()].filter(Boolean).join(' ')
    const composedAddress =
      cpCommune && data.companyPostalCode && !street.includes(data.companyPostalCode.trim())
        ? [street, cpCommune].filter(Boolean).join(', ')
        : street
    // Non bloquant : un échec (droits, réseau) ne doit pas empêcher l'enregistrement de l'AB.
    await updateCompany(parseInt(entreprise.id), {
      name: data.companyName,
      siret: data.companySiret,
      address: composedAddress,
      legalReferent: data.legalRepName,
      phone: data.legalRepPhone,
      email: data.legalRepEmail,
    })

    const dayToPeriods = (v: DayStatus): string[] =>
      v === 'OUI' ? ['MATIN', 'APRES_MIDI'] : v === 'PREFERE' ? ['PREFERE'] : []

    const trainingDaysJson = JSON.stringify({
      monday:    dayToPeriods(trainingDays.monday),
      tuesday:   dayToPeriods(trainingDays.tuesday),
      wednesday: dayToPeriods(trainingDays.wednesday),
      thursday:  dayToPeriods(trainingDays.thursday),
      friday:    dayToPeriods(trainingDays.friday),
    })

    const resolveFunction = (fn: string, other: string) =>
      fn === 'Autre' ? (other || null) : (fn || null)

    const responsible = data.isDifferentRecruitmentResponsible
      ? {
          recruitmentResponsibleName: data.recruitmentResponsibleName,
          recruitmentResponsiblePhone: data.recruitmentResponsiblePhone,
          recruitmentResponsibleEmail: data.recruitmentResponsibleEmail,
          recruitmentResponsibleFunction: resolveFunction(data.recruitmentResponsibleFunction, data.recruitmentResponsibleFunctionOther),
        }
      : {
          recruitmentResponsibleName: data.legalRepName,
          recruitmentResponsiblePhone: data.legalRepPhone,
          recruitmentResponsibleEmail: data.legalRepEmail,
          recruitmentResponsibleFunction: null,
        }

    const input = {
      companyID:          parseInt(entreprise.id),
      userID:             currentUser.id,
      legalRepFunction:   resolveFunction(data.legalRepFunction, data.legalRepFunctionOther),
      ...responsible,
      companySectors:     [...companySectors, ...(data.companySectorOther.trim() ? [data.companySectorOther.trim()] : [])],
      opco:               data.opco || null,
      companyDescription: data.companyDescriptionOther || null,
      postalCode:         data.companyPostalCode || null,
      commune:            data.companyCommune || null,
      positions:          postes.map((p) => ({
        trainingDomain:   p.trainingDomain,
        jobRole:          p.jobRole.trim(),
        count:            p.count,
        title:            p.desiredTp[0]?.jobTitle ?? '',
        localisation:     p.localisation,
        desiredTp:        p.desiredTp.map((tp) => ({
          tpType:                   TITLE_TO_TP[tp.jobTitle] ?? null,
          missions:                 tp.selectedMissions,
          descriptionMissions:      [],
          otherDescriptionMissions: tp.otherDescriptionMissions || null,
          otherMissions:            null,
        })),
        criteria: {
          educationLevel:     null,
          drivingLicense:     p.criteria.drivingLicense === 'OUI',
          experienceRequired: p.criteria.experienceRequired === 'OBLIGATOIRE',
          ageMin:             p.criteria.ageMin ? Number(p.criteria.ageMin) : null,
          ageMax:             p.criteria.ageMax ? Number(p.criteria.ageMax) : null,
          softSkills:         [...p.criteria.softSkills, ...(p.criteria.softSkillsOther ? [p.criteria.softSkillsOther] : [])].join(', ') || null,
          scheduleOptions:    p.criteria.scheduleOptions,
          conditions:         p.criteria.conditions || null,
          additionalComments: p.criteria.additionalComments || null,
        },
      })),
      recruitmentMethod:      data.recruitmentMethod,
      immersionPeriod:        data.immersionPeriod,
      trainingDays:           trainingDaysJson,
    }

    let response
    if (isEditing && initialData) {
      response = await updateMutation(initialData.id, input)
    } else {
      response = await createNeedsAnalysis(input)
    }

    if (response.error) { setSubmitError(response.error.message); return }

    // En édition l'id ne change pas ; en création/duplication on récupère le nouvel id.
    const savedId = isEditing ? initialData?.id : response.data?.createNeedsAnalysis?.id
    if (savedId) {
      if (intentRef.current === 'sign') {
        setPreviewId(savedId)
        return
      }
      if (intentRef.current === 'download') {
        try {
          await downloadPdf(savedId)
        } catch {
          setSubmitError('AB enregistrée, mais le téléchargement du PDF a échoué. Réessayez depuis la liste.')
          return
        }
      }
      // intent 'save' : rien de plus, on ferme.
    }

    onSuccess(savedId ?? '')
    onClose()
  } catch (error) {
    console.error('[NeedsAnalysisModal] onSubmit error:', error)
    setSubmitError(error instanceof Error ? error.message : 'Erreur inattendue lors de l\'enregistrement')
  }
  }

  // Confirmation de l'aperçu → envoi en signature réel, puis fermeture.
  const handleConfirmSignature = async (email: { subject: string; body: string }) => {
    if (previewId == null) return
    await sendForSignature(previewId, email)
    onSuccess(previewId)
    onClose()
  }

  const sendForSignature = async (id: string, email: { subject: string; body: string }) => {
    const res = await apiFetch(`/api/needs-analysis/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || `Envoi signature échoué (${res.status})`)
    }
  }

  const downloadPdf = async (id: string) => {
    const res = await apiFetch(`/api/needs-analysis/${id}/pdf`)
    if (!res.ok) throw new Error(`PDF download failed: ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Analyse_Besoin_${(entreprise.nom_commercial ?? 'Entreprise').replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {previewId !== null && (
        <SignaturePreviewModal
          abId={previewId}
          onConfirm={handleConfirmSignature}
          onCancel={() => {
            // AB déjà créée en BROUILLON : on ne l'envoie pas, on referme.
            setPreviewId(null)
            onSuccess(previewId)
            onClose()
          }}
        />
      )}
      <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-black">{isEditing ? "Modifier l'Analyse du Besoin" : isDuplicate ? "Dupliquer l'Analyse du Besoin" : "Analyse du Besoin"}</h2>
            <p className="text-sm text-gray-500">{entreprise.nom_commercial}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {/* Form — single scrollable page */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-8">

              {/* ── Identité de l'entreprise ─────────────────────────────────── */}
              <section className="flex flex-col gap-4">
                <SectionTitle>Identité de l'entreprise</SectionTitle>
                <InputField id="companyName" label="Dénomination ou raison sociale *" error={errors.companyName?.message}
                  {...register('companyName', { required: 'Champ obligatoire' })} />
                <InputField id="companySiret" label="Numéro SIRET *" placeholder="14 chiffres" error={errors.companySiret?.message}
                  {...register('companySiret', { required: 'Champ obligatoire', pattern: { value: /^\d{14}$/, message: '14 chiffres requis' } })} />
                <InputField id="companyAddress" label="Adresse du siège social *" error={errors.companyAddress?.message}
                  {...register('companyAddress', { required: 'Champ obligatoire' })} />
                <div className="grid grid-cols-2 gap-3">
                  <InputField id="companyPostalCode" label="Code postal *" placeholder="75001" error={errors.companyPostalCode?.message}
                    {...register('companyPostalCode', { required: 'Champ obligatoire', pattern: { value: /^\d{5}$/, message: 'Code postal invalide' } })} />
                  <InputField id="companyCommune" label="Commune *" error={errors.companyCommune?.message}
                    {...register('companyCommune', { required: 'Champ obligatoire' })} />
                </div>
              </section>

              {/* ── Représentant légal ───────────────────────────────────────── */}
              <section className="flex flex-col gap-4">
                <SectionTitle>Informations du représentant légal</SectionTitle>
                <InputField id="legalRepName" label="Nom et prénom *" error={errors.legalRepName?.message}
                  {...register('legalRepName', { required: 'Champ obligatoire' })} />
                <SelectField id="legalRepFunction" label="Fonction *" options={FONCTIONS}
                  error={errors.legalRepFunction?.message}
                  required
                  {...register('legalRepFunction', { required: 'Champ obligatoire' })} />
                {legalRepFunction === 'Autre' && (
                  <InputField id="legalRepFunctionOther" label="Précisez la fonction *" placeholder="Ex : Responsable d'agence…"
                    error={errors.legalRepFunctionOther?.message}
                    {...register('legalRepFunctionOther', { required: legalRepFunction === 'Autre' ? 'Champ obligatoire' : false })} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InputField id="legalRepPhone" label="Téléphone *" type="tel" error={errors.legalRepPhone?.message}
                    {...register('legalRepPhone', { required: 'Champ obligatoire', pattern: { value: /^[0-9+\s\-().]{8,20}$/, message: 'Numéro invalide' } })} />
                  <InputField id="legalRepEmail" label="Courriel *" type="email" error={errors.legalRepEmail?.message}
                    {...register('legalRepEmail', { required: 'Champ obligatoire', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' } })} />
                </div>
              </section>

              {/* ── Responsable recrutement ──────────────────────────────────── */}
              <section className="flex flex-col gap-4">
                <SectionTitle>Responsable de recrutement</SectionTitle>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 hover:border-blue-light">
                  <div className={['flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors', isDifferentResponsible ? 'border-blue bg-blue' : 'border-gray-300 bg-white'].join(' ')}>
                    {isDifferentResponsible && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <input type="checkbox" className="sr-only" {...register('isDifferentRecruitmentResponsible')} />
                  <span className="text-sm text-gray-700">Le responsable de recrutement est différent du représentant légal</span>
                </label>

                {isDifferentResponsible ? (
                  <div className="flex flex-col gap-4 rounded-lg border border-blue-light bg-blue-light/30 p-4">
                    <InputField id="recruitmentResponsibleName" label="Nom et prénom *" error={errors.recruitmentResponsibleName?.message}
                      {...register('recruitmentResponsibleName', { required: isDifferentResponsible ? 'Champ obligatoire' : false })} />
                    <SelectField id="recruitmentResponsibleFunction" label="Fonction" options={FONCTIONS}
                      {...register('recruitmentResponsibleFunction')} />
                    {responsibleFunction === 'Autre' && (
                      <InputField id="recruitmentResponsibleFunctionOther" label="Précisez la fonction *" placeholder="Ex : Responsable d'agence…"
                        error={errors.recruitmentResponsibleFunctionOther?.message}
                        {...register('recruitmentResponsibleFunctionOther', { required: isDifferentResponsible && responsibleFunction === 'Autre' ? 'Champ obligatoire' : false })} />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <InputField id="recruitmentResponsiblePhone" label="Téléphone *" type="tel" error={errors.recruitmentResponsiblePhone?.message}
                        {...register('recruitmentResponsiblePhone', { required: isDifferentResponsible ? 'Champ obligatoire' : false, pattern: { value: /^[0-9+\s\-().]{8,20}$/, message: 'Numéro invalide' } })} />
                      <InputField id="recruitmentResponsibleEmail" label="Courriel *" type="email" error={errors.recruitmentResponsibleEmail?.message}
                        {...register('recruitmentResponsibleEmail', { required: isDifferentResponsible ? 'Champ obligatoire' : false, pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' } })} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                    Le représentant légal sera utilisé comme responsable de recrutement.
                  </div>
                )}
              </section>

              {/* ── À propos de l'entreprise ─────────────────────────────────── */}
              <section className="flex flex-col gap-5">
                <SectionTitle>À propos de l'entreprise</SectionTitle>

                <CheckboxGroup
                  label="Secteur(s) d'activité"
                  options={SECTEURS}
                  selected={companySectors}
                  onChange={(v) => setValue('companySectors', v)}
                  columns={2}
                  renderLabel={(s) => SECTOR_LABELS[s] ?? s}
                />

                <div className="flex flex-col gap-2">
                  <InputField id="companySectorOther" label="Autre secteur d'activité (optionnel)"
                    placeholder="Précisez un autre secteur…"
                    {...register('companySectorOther')} />
                  {customSectors.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {customSectors.map((sector) => (
                        <span key={sector}
                          className="inline-flex items-center gap-2 rounded-full border border-blue-light bg-blue-light/30 px-3 py-1 text-sm text-blue">
                          {sector}
                          <button
                            type="button"
                            onClick={() => removeCustomSector(sector)}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-blue transition-colors hover:bg-blue hover:text-white"
                            aria-label={`Retirer le secteur ${sector}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="opco" className="text-sm font-medium text-gray-700">
                    OPCO <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <select
                    id="opco"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    {...register('opco')}>
                    <option value="">Sélectionnez l'OPCO de l'entreprise…</option>
                    {OPCO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <TextareaField id="companyDescriptionOther" label="Précisions complémentaires" optional rows={3}
                  placeholder="Mission globale, spécificités de l'entreprise…"
                  {...register('companyDescriptionOther')} />
              </section>

              {/* ── Postes à pourvoir ────────────────────────────────────────── */}
              <section className="flex flex-col gap-5">
                <SectionTitle>Poste(s) à pourvoir</SectionTitle>

                {postes.map((poste, index) => (
                  <div key={index} className="flex flex-col gap-5 rounded-xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(index)}
                        className="flex flex-1 items-center gap-2 overflow-hidden text-left text-sm font-bold text-gray-900"
                      >
                        {collapsed[index]
                          ? <ChevronRight size={16} className="shrink-0 text-gray-400" />
                          : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
                        <Briefcase size={14} className="shrink-0 text-blue" />
                        <span className="truncate">{poste.jobRole.trim() || 'Nouveau poste'}</span>
                        {collapsed[index] && poste.trainingDomain && (
                          <span className="truncate text-xs font-normal text-gray-500">
                            · {poste.trainingDomain === 'VENTE' ? 'Vente' : 'Secrétariat'}
                            {poste.localisation.length > 0 && ` · ${poste.localisation.length} commune${poste.localisation.length > 1 ? 's' : ''}`}
                          </span>
                        )}
                      </button>
                      <QuantityStepper value={poste.count} onChange={(v) => updatePoste(index, { count: v })} max={10} />
                      {postes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePoste(index)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-danger/10 hover:text-danger"
                          aria-label="Supprimer ce poste"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {collapsed[index] ? (
                      posteErrors[index] && <FieldError message={posteErrors[index]} />
                    ) : (
                    <>
                    <InputField
                      id={`jobRole-${index}`}
                      label="Intitulé de métier *"
                      placeholder="Ex. Assistant commercial…"
                      required
                      value={poste.jobRole}
                      onChange={(e) => updatePoste(index, { jobRole: e.target.value })}
                    />

                    <RadioGroup label="Domaine de formation *"
                      options={[
                        { value: 'SECRETARIAT' as const, label: 'Secrétariat (Administratif)' },
                        { value: 'VENTE' as const,       label: 'Vente (Commercial)' },
                      ]}
                      value={poste.trainingDomain}
                      onChange={(v) => updatePoste(index, { trainingDomain: v, desiredTp: [] })}
                      required />

                    {poste.trainingDomain && (
                      <CheckboxGroup
                        label="Titre(s) professionnel(s) visé(s) *"
                        options={JOB_TITLES_BY_DOMAIN[poste.trainingDomain]}
                        selected={poste.desiredTp.map((tp) => tp.jobTitle)}
                        onChange={(titles) => setPosteTitles(index, titles)}
                        columns={1}
                      />
                    )}

                    {poste.trainingDomain && poste.desiredTp.map((tp, tpIndex) => (
                      <TpMissionsFields
                        key={tp.jobTitle}
                        domain={poste.trainingDomain!}
                        tp={tp}
                        onChangeMissions={(missions) => updatePosteTp(index, tpIndex, { selectedMissions: missions })}
                        onChangeOther={(value) => updatePosteTp(index, tpIndex, { otherDescriptionMissions: value })}
                      />
                    ))}

                    <CheckboxGroup label="Localisation du poste (communes) *"
                      options={COMMUNES}
                      selected={poste.localisation}
                      onChange={(v) => updatePoste(index, { localisation: v as Localisation[] })}
                      renderLabel={formatCommune}
                      columns={2} />

                    <CheckboxGroup
                      label="Compétences et savoir-être attendus"
                      options={SOFT_SKILLS_LIST}
                      selected={poste.criteria.softSkills}
                      onChange={(v) => updatePoste(index, { criteria: { ...poste.criteria, softSkills: v } })}
                      columns={2}
                    />
                    <InputField id={`softSkillsOther-${index}`} label="Autre compétence (optionnel)"
                      placeholder="Ex : maîtrise d'un logiciel spécifique…"
                      value={poste.criteria.softSkillsOther}
                      onChange={(e) => updatePoste(index, { criteria: { ...poste.criteria, softSkillsOther: e.target.value } })} />

                    <ScheduleDaysEditor
                      value={poste.criteria.scheduleOptions}
                      onChange={(slots) => updatePoste(index, { criteria: { ...poste.criteria, scheduleOptions: slots } })}
                    />

                    <TextareaField id={`conditions-${index}`} label="Conditions du poste" optional rows={3}
                      placeholder="Horaires, télétravail, avantages, véhicule…"
                      value={poste.criteria.conditions}
                      onChange={(e) => updatePoste(index, { criteria: { ...poste.criteria, conditions: e.target.value } })} />

                    <TextareaField id={`additionalComments-${index}`} label="Commentaires supplémentaires" optional rows={2}
                      placeholder="Salaire, avantages, informations spécifiques…"
                      value={poste.criteria.additionalComments}
                      onChange={(e) => updatePoste(index, { criteria: { ...poste.criteria, additionalComments: e.target.value } })} />

                    <RadioGroup label="Permis de conduire B *"
                      options={[{ value: 'OUI' as const, label: 'Obligatoire' }, { value: 'OPTIONNEL' as const, label: 'Optionnel' }]}
                      value={poste.criteria.drivingLicense}
                      onChange={(v) => updatePoste(index, { criteria: { ...poste.criteria, drivingLicense: v } })}
                      required />

                    <RadioGroup label="Expérience requise *"
                      options={[{ value: 'DEBUTANT' as const, label: 'Débutant accepté' }, { value: 'OBLIGATOIRE' as const, label: 'Expérience obligatoire' }]}
                      value={poste.criteria.experienceRequired}
                      onChange={(v) => updatePoste(index, { criteria: { ...poste.criteria, experienceRequired: v } })}
                      required />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Âge souhaité <span className="text-gray-400">(optionnel)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <InputField id={`ageMin-${index}`} label="De (ans)" type="number" min={15} max={99} placeholder="18"
                          value={poste.criteria.ageMin}
                          onChange={(e) => updatePoste(index, { criteria: { ...poste.criteria, ageMin: e.target.value } })} />
                        <InputField id={`ageMax-${index}`} label="À (ans)" type="number" min={15} max={99} placeholder="29"
                          value={poste.criteria.ageMax}
                          onChange={(e) => updatePoste(index, { criteria: { ...poste.criteria, ageMax: e.target.value } })} />
                      </div>
                    </div>

                    {posteErrors[index] && <FieldError message={posteErrors[index]} />}
                    </>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Total : {postes.reduce((sum, p) => sum + p.count, 0)} poste{postes.reduce((sum, p) => sum + p.count, 0) > 1 ? 's' : ''} à pourvoir
                  </p>
                  <Button type="button" variant="secondary" onClick={addPoste}>
                    <Plus size={16} /> Ajouter un poste
                  </Button>
                </div>
              </section>

              {/* ── Exigences de l'apprenti ──────────────────────────────────── */}
              <section className="flex flex-col gap-5">
                <SectionTitle>Recrutement</SectionTitle>

                <input type="hidden" {...register('recruitmentMethod',  { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('immersionPeriod',    { required: 'Champ obligatoire' })} />

                <RadioGroup label="Méthode de recrutement *"
                  options={[
                    { value: 'ALL_CV' as const,        label: 'Tous les CV' },
                    { value: 'PRESELECTION' as const,  label: 'Présélection par le centre' },
                    { value: 'PRE_INTERVIEW' as const, label: 'Pré-entretien par le centre' },
                  ]}
                  value={watch('recruitmentMethod')}
                  onChange={(v) => setValue('recruitmentMethod', v, { shouldValidate: true })}
                  error={errors.recruitmentMethod?.message} required />

                <RadioGroup label="Période d'immersion (PMSMP) *"
                  options={[{ value: 'OUI' as const, label: 'Oui' }, { value: 'NON' as const, label: 'Non' }, { value: 'A_DISCUTER' as const, label: 'À discuter' }]}
                  value={watch('immersionPeriod')}
                  onChange={(v) => setValue('immersionPeriod', v, { shouldValidate: true })}
                  error={errors.immersionPeriod?.message} required />

                {/* Grille jours — tout à Oui par défaut */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-gray-700">Jours de formation possibles</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 w-24" />
                          {DAYS.map((d) => (
                            <th key={d.key} className="px-3 py-2.5 text-center font-medium text-gray-700">{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(['OUI', 'NON', 'PREFERE'] as DayStatus[]).map((status) => (
                          <tr key={status} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2.5 font-medium text-gray-700">
                              {status === 'OUI' ? 'Oui' : status === 'NON' ? 'Non' : 'Préféré'}
                            </td>
                            {DAYS.map((d) => (
                              <td key={d.key} className="px-3 py-2.5 text-center">
                                <button type="button"
                                  onClick={() => setTrainingDays((prev) => ({ ...prev, [d.key]: status }))}
                                  className={['mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                                    trainingDays[d.key] === status ? 'border-blue bg-blue' : 'border-gray-300 bg-white hover:border-blue-light',
                                  ].join(' ')}>
                                  {trainingDays[d.key] === status && <div className="h-2 w-2 rounded-full bg-white" />}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {submitError && (
                <p className="rounded-lg border border-danger-bg bg-danger-bg px-4 py-2.5 text-sm text-danger">
                  {submitError}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={result.fetching}
                    leftIcon={<Check size={16} />}
                    onClick={() => { intentRef.current = 'save' }}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    type="submit"
                    isLoading={result.fetching}
                    leftIcon={<PenLine size={16} />}
                    onClick={() => { intentRef.current = 'sign' }}
                  >
                    Enregistrer & envoyer en signature
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={result.fetching}
                    leftIcon={<Check size={16} />}
                    onClick={() => { intentRef.current = 'download' }}
                  >
                    Enregistrer & télécharger
                  </Button>
                  <Button
                    type="submit"
                    isLoading={result.fetching}
                    leftIcon={<PenLine size={16} />}
                    onClick={() => { intentRef.current = 'sign' }}
                  >
                    Enregistrer & envoyer en signature
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
