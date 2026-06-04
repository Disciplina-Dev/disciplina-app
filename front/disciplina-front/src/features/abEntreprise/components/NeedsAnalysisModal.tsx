import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import {
  X, ChevronRight, ChevronLeft, Check,
  Building2, User, Users, Info, Briefcase,
  GraduationCap, Shield, ClipboardList, Plus, Minus,
} from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { useCreateNeedsAnalysis } from '@/graphql/hooks'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayStatus = 'OUI' | 'NON' | 'PREFERE'

interface TrainingDaysState {
  monday: DayStatus
  tuesday: DayStatus
  wednesday: DayStatus
  thursday: DayStatus
  friday: DayStatus
}

interface FormData {
  // Étape 1
  companyName: string
  companySiret: string
  companyAddress: string
  companyPostalCode: string
  companyCommune: string
  // Étape 2
  legalRepName: string
  legalRepFunction: string
  legalRepPhone: string
  legalRepEmail: string
  // Étape 3
  isDifferentRecruitmentResponsible: boolean
  recruitmentResponsibleName: string
  recruitmentResponsibleFunction: string
  recruitmentResponsiblePhone: string
  recruitmentResponsibleEmail: string
  // Étape 4
  companySectors: string[]
  companyDescriptionOther: string
  positionsCount: number
  localisation: 'NORD' | 'OUEST' | 'SUD'
  // Étape 5
  jobTitle: string
  jobDescriptionMissions: string[]
  jobDescriptionOther: string
  softSkills: string[]
  softSkillsOther: string
  scheduleOptions: string[]
  additionalComments: string
  // Étape 6
  trainingDomain: 'SECRETARIAT' | 'VENTE'
  educationLevel: 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3'
  drivingLicense: 'OUI' | 'OPTIONNEL'
  experienceRequired: 'DEBUTANT' | 'OBLIGATOIRE'
  ageRequirements: string[]
  recruitmentMethod: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW'
  immersionPeriod: 'OUI' | 'NON' | 'A_DISCUTER'
  // Étape 7
  clausesAccepted: boolean
  // Étape 8
  selectedMissions: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identité',     icon: Building2 },
  { id: 2, label: 'Représentant', icon: User },
  { id: 3, label: 'Recrutement',  icon: Users },
  { id: 4, label: 'Entreprise',   icon: Info },
  { id: 5, label: 'Poste',        icon: Briefcase },
  { id: 6, label: 'Apprenti',     icon: GraduationCap },
  { id: 7, label: 'Engagement',   icon: Shield },
]

const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  1: ['companyName', 'companySiret', 'companyAddress', 'companyPostalCode', 'companyCommune'],
  2: ['legalRepName', 'legalRepFunction', 'legalRepPhone', 'legalRepEmail'],
  3: [],
  4: ['positionsCount', 'localisation'],
  5: ['trainingDomain', 'jobTitle'],
  6: ['educationLevel', 'drivingLicense', 'experienceRequired', 'recruitmentMethod', 'immersionPeriod'],
  7: ['clausesAccepted'],
}

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

const SECTEURS = [
  'Commerce / Vente',
  'Services aux entreprises',
  'Services aux particuliers',
  'Industrie / Production',
  'BTP / Construction',
  'Santé / Social',
  'Restauration / Hôtellerie',
  'Transport / Logistique',
  'Informatique / Numérique',
  'Finance / Assurance',
  'Immobilier',
  'Éducation / Formation',
  'Agriculture / Agroalimentaire',
]

const JOB_TITLES_BY_DOMAIN: Record<'SECRETARIAT' | 'VENTE', string[]> = {
  SECRETARIAT: ['Secrétaire Assistante', 'Assistante de Direction'],
  VENTE: ['Conseiller Commercial', 'Négociateur Technico-Commercial', "Responsable d'Établissement Marchand"],
}

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

const JOB_DESCRIPTION_OPTIONS = [
  'Accueil physique et téléphonique',
  'Gestion administrative et rédaction',
  'Gestion des agendas et rendez-vous',
  'Traitement du courrier',
  'Saisie et mise à jour de données',
  'Relation client et conseil',
  'Prospection et développement commercial',
  'Suivi de dossiers et reporting',
  'Organisation de réunions et événements',
  'Gestion des stocks et approvisionnements',
]

const SCHEDULE_OPTIONS = [
  'Temps plein (35h)',
  'Temps partiel',
  'Horaires fixes (9h-17h)',
  'Horaires décalés',
  'Travail le samedi',
  'Télétravail possible',
  '100% présentiel',
  'Véhicule de service fourni',
  'Tickets restaurant',
  'Mutuelle entreprise',
]

const MISSIONS: Record<'SECRETARIAT' | 'VENTE', Record<string, string[]>> = {
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
  { key: 'tuesday',  label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday',   label: 'Vendredi' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function NumberStepper({
  label, value, onChange, min = 1, max = 99, required,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-1 text-danger">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-700 transition-colors hover:border-blue hover:text-blue disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[3rem] text-center text-xl font-bold text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-700 transition-colors hover:border-blue hover:text-blue disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
        <span className="text-sm text-gray-500">poste{value > 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function RadioGroup<T extends string>({
  label, name, options, value, onChange, error, required,
}: {
  label: string
  name: string
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
  label, options, selected, onChange, columns = 2,
}: {
  label?: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  columns?: 1 | 2 | 3
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
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onSuccess: () => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NeedsAnalysisModal({ entreprise, currentUser, onClose, onSuccess }: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [trainingDays, setTrainingDays] = useState<TrainingDaysState>({
    monday: 'NON', tuesday: 'NON', wednesday: 'NON', thursday: 'NON', friday: 'NON',
  })
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { createNeedsAnalysis, result } = useCreateNeedsAnalysis()

  const { register, watch, setValue, handleSubmit, trigger, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      companyName:        entreprise.nom_commercial ?? '',
      companySiret:       entreprise.siret ?? '',
      companyAddress:     entreprise.adresse ?? '',
      companyPostalCode:  '',
      companyCommune:     '',
      legalRepName:       entreprise.representant_legal ?? '',
      legalRepFunction:   '',
      legalRepPhone:      entreprise.telephone ?? '',
      legalRepEmail:      entreprise.email ?? '',
      isDifferentRecruitmentResponsible: false,
      recruitmentResponsibleName:     '',
      recruitmentResponsibleFunction: '',
      recruitmentResponsiblePhone:    '',
      recruitmentResponsibleEmail:    '',
      companySectors:           [],
      companyDescriptionOther:  '',
      positionsCount:           1,
      localisation:             undefined,
      jobTitle:                 '',
      jobDescriptionMissions:   [],
      jobDescriptionOther:      '',
      softSkills:               [],
      softSkillsOther:          '',
      scheduleOptions:          [],
      additionalComments:       '',
      trainingDomain:     undefined,
      educationLevel:     undefined,
      drivingLicense:     undefined,
      experienceRequired: undefined,
      ageRequirements:    [],
      recruitmentMethod:  undefined,
      immersionPeriod:    undefined,
      clausesAccepted:    false,
      selectedMissions:   [],
    },
  })

  const isDifferentResponsible  = watch('isDifferentRecruitmentResponsible')
  const trainingDomain          = watch('trainingDomain')
  const jobTitle                = watch('jobTitle')
  const selectedMissions        = watch('selectedMissions') ?? []
  const ageRequirements         = watch('ageRequirements') ?? []
  const companySectors          = watch('companySectors') ?? []
  const softSkills              = watch('softSkills') ?? []
  const scheduleOptions         = watch('scheduleOptions') ?? []
  const positionsCount          = watch('positionsCount') ?? 1

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const goNext = async () => {
    const fields = STEP_FIELDS[currentStep]
    const valid = fields.length === 0 ? true : await trigger(fields)
    if (!valid) return
    setCurrentStep((s) => Math.min(s + 1, STEPS.length))
  }

  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 1))

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)

    if (!data.clausesAccepted) {
      setSubmitError('Vous devez accepter les clauses pour continuer.')
      return
    }
    if (selectedMissions.length === 0) {
      setSubmitError('Sélectionnez au moins une mission.')
      return
    }


    const softSkillsFull = [
      ...data.softSkills,
      ...(data.softSkillsOther ? [data.softSkillsOther] : []),
    ].join(', ') || null

    const dayToPeriods = (v: DayStatus): string[] =>
      v === 'OUI' ? ['MATIN', 'APRES_MIDI'] : v === 'PREFERE' ? ['PREFERE'] : []

    const trainingDaysJson = JSON.stringify({
      monday:    dayToPeriods(trainingDays.monday),
      tuesday:   dayToPeriods(trainingDays.tuesday),
      wednesday: dayToPeriods(trainingDays.wednesday),
      thursday:  dayToPeriods(trainingDays.thursday),
      friday:    dayToPeriods(trainingDays.friday),
    })

    const responsible = data.isDifferentRecruitmentResponsible
      ? { recruitmentResponsibleName: data.recruitmentResponsibleName, recruitmentResponsiblePhone: data.recruitmentResponsiblePhone, recruitmentResponsibleEmail: data.recruitmentResponsibleEmail }
      : { recruitmentResponsibleName: data.legalRepName, recruitmentResponsiblePhone: data.legalRepPhone, recruitmentResponsibleEmail: data.legalRepEmail }

    const response = await createNeedsAnalysis({
      companyID:                        parseInt(entreprise.id),
      userID:                           currentUser.id,
      legalRepFunction:                 data.legalRepFunction || null,
      ...responsible,
      recruitmentResponsibleFunction:   data.isDifferentRecruitmentResponsible ? (data.recruitmentResponsibleFunction || null) : null,
      companySectors:                   companySectors,
      companyDescription:               data.companyDescriptionOther || null,
      positionsCount:                   Number(data.positionsCount),
      localisation:                     data.localisation,
      trainingDomain:                   data.trainingDomain,
      jobTitle:                         data.jobTitle,
      selectedMissions:                 data.selectedMissions,
      jobDescriptionMissions:           [],
      jobDescriptionOther:              data.jobDescriptionOther || null,
      educationLevel:                   data.educationLevel,
      drivingLicense:                   data.drivingLicense,
      experienceRequired:               data.experienceRequired,
      ageRequirements:                  data.ageRequirements,
      softSkills:                       softSkillsFull,
      scheduleOptions:                  scheduleOptions,
      additionalComments:               data.additionalComments || null,
      recruitmentMethod:                data.recruitmentMethod,
      immersionPeriod:                  data.immersionPeriod,
      trainingDays:                     trainingDaysJson,
    })

    if (response.error) { setSubmitError(response.error.message); return }
    onSuccess()
    onClose()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-black">Analyse du Besoin</h2>
            <p className="text-sm text-gray-500">{entreprise.nom_commercial}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              const done   = currentStep > step.id
              const active = currentStep === step.id
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <div className={['flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors', active ? 'bg-blue text-white' : done ? 'bg-blue-light text-blue' : 'text-gray-500'].join(' ')}>
                    {done ? <Check size={12} strokeWidth={2.5} /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.id}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={['h-px w-4 flex-shrink-0', done ? 'bg-blue' : 'bg-gray-200'].join(' ')} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── Étape 1 : Identité ────────────────────────────────────────── */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-4">
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
              </div>
            )}

            {/* ── Étape 2 : Représentant légal ─────────────────────────────── */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-4">
                <SectionTitle>Informations du représentant légal</SectionTitle>
                <InputField id="legalRepName" label="Nom et prénom *" error={errors.legalRepName?.message}
                  {...register('legalRepName', { required: 'Champ obligatoire' })} />
                <SelectField id="legalRepFunction" label="Fonction *" options={FONCTIONS}
                  error={errors.legalRepFunction?.message}
                  required
                  {...register('legalRepFunction', { required: 'Champ obligatoire' })} />
                <div className="grid grid-cols-2 gap-3">
                  <InputField id="legalRepPhone" label="Téléphone *" type="tel" error={errors.legalRepPhone?.message}
                    {...register('legalRepPhone', { required: 'Champ obligatoire', pattern: { value: /^[0-9+\s\-().]{8,20}$/, message: 'Numéro invalide' } })} />
                  <InputField id="legalRepEmail" label="Courriel *" type="email" error={errors.legalRepEmail?.message}
                    {...register('legalRepEmail', { required: 'Champ obligatoire', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' } })} />
                </div>
              </div>
            )}

            {/* ── Étape 3 : Responsable recrutement ────────────────────────── */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-4">
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
              </div>
            )}

            {/* ── Étape 4 : À propos de l'entreprise ───────────────────────── */}
            {currentStep === 4 && (
              <div className="flex flex-col gap-5">
                <SectionTitle>À propos de l'entreprise</SectionTitle>

                <CheckboxGroup
                  label="Secteur(s) d'activité"
                  options={SECTEURS}
                  selected={companySectors}
                  onChange={(v) => setValue('companySectors', v)}
                  columns={2}
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="companyDescriptionOther" className="text-sm font-medium text-gray-700">
                    Précisions complémentaires <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <textarea id="companyDescriptionOther" rows={3}
                    className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue"
                    placeholder="Mission globale, spécificités de l'entreprise…"
                    {...register('companyDescriptionOther')} />
                </div>

                <input type="hidden" {...register('localisation', { required: 'Champ obligatoire' })} />
                <RadioGroup
                  label="Localisation du poste *"
                  name="localisation"
                  options={[{ value: 'NORD', label: 'Nord' }, { value: 'OUEST', label: 'Ouest' }, { value: 'SUD', label: 'Sud' }]}
                  value={watch('localisation')}
                  onChange={(v) => setValue('localisation', v, { shouldValidate: true })}
                  error={errors.localisation?.message}
                  required
                />

                <NumberStepper
                  label="Nombre de poste(s) à pourvoir *"
                  value={positionsCount}
                  onChange={(v) => setValue('positionsCount', v)}
                  required
                />
              </div>
            )}

            {/* ── Étape 5 : Exigences du poste ─────────────────────────────── */}
            {currentStep === 5 && (
              <div className="flex flex-col gap-5">
                <SectionTitle>Exigences du poste à pourvoir</SectionTitle>

                {/* Domain first — drives job title options */}
                <input type="hidden" {...register('trainingDomain', { required: 'Champ obligatoire' })} />
                <RadioGroup label="Domaine de formation *" name="trainingDomain"
                  options={[
                    { value: 'SECRETARIAT', label: 'Secrétariat (Administratif)' },
                    { value: 'VENTE',       label: 'Vente (Commercial)' },
                  ]}
                  value={watch('trainingDomain')}
                  onChange={(v) => {
                    setValue('trainingDomain', v, { shouldValidate: true })
                    setValue('jobTitle', '', { shouldValidate: false })
                    setValue('selectedMissions', [])
                  }}
                  error={errors.trainingDomain?.message} required />

                {/* Job title filtered by domain */}
                {trainingDomain && (
                  <SelectField
                    id="jobTitle"
                    label="Intitulé du métier *"
                    options={JOB_TITLES_BY_DOMAIN[trainingDomain]}
                    error={errors.jobTitle?.message}
                    required
                    {...register('jobTitle', {
                      required: 'Champ obligatoire',
                      onChange: () => setValue('selectedMissions', []),
                    })}
                  />
                )}

                {/* Missions specific to the selected job title */}
                {jobTitle && trainingDomain && MISSIONS[trainingDomain]?.[jobTitle] && (
                  <div className="flex flex-col gap-2">
                    <CheckboxGroup
                      label={`Missions à confier à l'apprenti — ${jobTitle}`}
                      options={MISSIONS[trainingDomain][jobTitle]}
                      selected={selectedMissions}
                      onChange={(v) => setValue('selectedMissions', v)}
                      columns={2}
                    />
                    {selectedMissions.length > 0 && (
                      <p className="text-xs text-blue">
                        {selectedMissions.length} mission{selectedMissions.length > 1 ? 's' : ''} sélectionnée{selectedMissions.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="jobDescriptionOther" className="text-sm font-medium text-gray-700">
                    Description complémentaire <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <textarea id="jobDescriptionOther" rows={3}
                    className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue"
                    placeholder="Responsabilités spécifiques, contexte…"
                    {...register('jobDescriptionOther')} />
                </div>

                <CheckboxGroup
                  label="Compétences et savoir-être attendus"
                  options={SOFT_SKILLS_LIST}
                  selected={softSkills}
                  onChange={(v) => setValue('softSkills', v)}
                  columns={2}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="softSkillsOther" className="text-sm font-medium text-gray-700">
                    Autre compétence <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <input id="softSkillsOther" type="text"
                    className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue"
                    placeholder="Ex : maîtrise d'un logiciel spécifique…"
                    {...register('softSkillsOther')} />
                </div>

                <CheckboxGroup
                  label="Conditions du poste"
                  options={SCHEDULE_OPTIONS}
                  selected={scheduleOptions}
                  onChange={(v) => setValue('scheduleOptions', v)}
                  columns={2}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="additionalComments" className="text-sm font-medium text-gray-700">
                    Commentaires supplémentaires <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <textarea id="additionalComments" rows={2}
                    className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue"
                    placeholder="Salaire, avantages, informations spécifiques…"
                    {...register('additionalComments')} />
                </div>
              </div>
            )}

            {/* ── Étape 6 : Exigences de l'apprenti ────────────────────────── */}
            {currentStep === 6 && (
              <div className="flex flex-col gap-5">
                <SectionTitle>Exigences de l'apprenti</SectionTitle>

                <input type="hidden" {...register('educationLevel',     { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('drivingLicense',     { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('experienceRequired', { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('recruitmentMethod',  { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('immersionPeriod',    { required: 'Champ obligatoire' })} />

                <RadioGroup label="Niveau de formation *" name="educationLevel"
                  options={[{ value: 'BAC', label: 'Niveau Bac' }, { value: 'BAC_PLUS_2', label: 'Bac +2' }, { value: 'BAC_PLUS_3', label: 'Bac +3' }]}
                  value={watch('educationLevel')}
                  onChange={(v) => setValue('educationLevel', v, { shouldValidate: true })}
                  error={errors.educationLevel?.message} required />

                <RadioGroup label="Permis de conduire B *" name="drivingLicense"
                  options={[{ value: 'OUI', label: 'Obligatoire' }, { value: 'OPTIONNEL', label: 'Optionnel' }]}
                  value={watch('drivingLicense')}
                  onChange={(v) => setValue('drivingLicense', v, { shouldValidate: true })}
                  error={errors.drivingLicense?.message} required />

                <RadioGroup label="Expérience requise *" name="experienceRequired"
                  options={[{ value: 'DEBUTANT', label: 'Débutant accepté' }, { value: 'OBLIGATOIRE', label: 'Expérience obligatoire' }]}
                  value={watch('experienceRequired')}
                  onChange={(v) => setValue('experienceRequired', v, { shouldValidate: true })}
                  error={errors.experienceRequired?.message} required />

                <CheckboxGroup
                  label="Tranche(s) d'âge ciblée(s)"
                  options={['18 à 20 ans', '21 à 25 ans', '26 à 29 ans']}
                  selected={ageRequirements}
                  onChange={(v) => setValue('ageRequirements', v)}
                  columns={3}
                />

                <RadioGroup label="Méthode de recrutement *" name="recruitmentMethod"
                  options={[
                    { value: 'ALL_CV',        label: 'Tous les CV' },
                    { value: 'PRESELECTION',  label: 'Présélection par le centre' },
                    { value: 'PRE_INTERVIEW', label: 'Pré-entretien par le centre' },
                  ]}
                  value={watch('recruitmentMethod')}
                  onChange={(v) => setValue('recruitmentMethod', v, { shouldValidate: true })}
                  error={errors.recruitmentMethod?.message} required />

                <RadioGroup label="Période d'immersion (PMSMP) *" name="immersionPeriod"
                  options={[{ value: 'OUI', label: 'Oui' }, { value: 'NON', label: 'Non' }, { value: 'A_DISCUTER', label: 'À discuter' }]}
                  value={watch('immersionPeriod')}
                  onChange={(v) => setValue('immersionPeriod', v, { shouldValidate: true })}
                  error={errors.immersionPeriod?.message} required />

                {/* Grille jours */}
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
              </div>
            )}

            {/* ── Étape 7 : Engagement ─────────────────────────────────────── */}
            {currentStep === 7 && (
              <div className="flex flex-col gap-5">
                <SectionTitle>Engagement sur l'évolution des missions</SectionTitle>
                <div className="rounded-lg border border-blue-light bg-blue-light/40 p-4 text-sm leading-relaxed text-gray-700">
                  <p className="font-semibold mb-2">L'entreprise reconnaît que les missions confiées à l'apprenti pourront :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Évoluer progressivement en fonction de sa montée en compétences.</li>
                    <li>Être adaptées afin de rester en cohérence avec le parcours de formation suivi.</li>
                    <li>Faire l'objet de réajustements en accord avec le centre de formation, dans un souci de complémentarité entre la pratique en entreprise et les enseignements dispensés.</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-gray-900">Clause de non-engagement et de confidentialité</p>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                    Les informations recueillies dans ce document sont strictement confidentielles et ne seront utilisées qu'à des fins de recrutement en apprentissage. La présente analyse du besoin ne constitue pas un engagement ferme de l'entreprise ni du centre de formation. Elle formalise uniquement l'intention d'explorer un parcours d'alternance sous réserve d'éligibilité des candidats et d'accord de financement OPCO. Toute diffusion des informations contenues dans ce document à des tiers est interdite sans accord préalable écrit des deux parties.
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-white p-4 hover:border-blue-light">
                  <div className={['mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors', watch('clausesAccepted') ? 'border-blue bg-blue' : 'border-gray-300 bg-white'].join(' ')}>
                    {watch('clausesAccepted') && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <input type="checkbox" className="sr-only" {...register('clausesAccepted', { required: true })} />
                  <span className="text-sm text-gray-700">J'ai lu et j'accepte les clauses d'engagement et de confidentialité. *</span>
                </label>
                {errors.clausesAccepted && <p className="text-xs text-danger">Vous devez accepter les clauses pour continuer.</p>}
                {submitError && (
                  <p className="rounded-lg border border-danger-bg bg-danger-bg px-4 py-2.5 text-sm text-danger">
                    {submitError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <Button variant="secondary" onClick={currentStep === 1 ? onClose : goPrev}
              leftIcon={currentStep > 1 ? <ChevronLeft size={16} /> : undefined}>
              {currentStep === 1 ? 'Annuler' : 'Précédent'}
            </Button>

            {currentStep < STEPS.length ? (
              <Button onClick={goNext} rightIcon={<ChevronRight size={16} />}>Suivant</Button>
            ) : (
              <Button type="submit" isLoading={result.fetching} leftIcon={<Check size={16} />}>
                Envoyer pour signature
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
