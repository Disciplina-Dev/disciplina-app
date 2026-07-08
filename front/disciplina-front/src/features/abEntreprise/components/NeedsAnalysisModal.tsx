import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import {
  X, Check, Briefcase, Plus, Minus, PenLine,
} from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { useCreateNeedsAnalysis, useUpdateCompany } from '@/graphql/hooks'
import SignaturePreviewModal from './SignaturePreviewModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayStatus = 'OUI' | 'NON' | 'PREFERE'
type TrainingDomain = 'SECRETARIAT' | 'VENTE'
type Localisation = 'NORD' | 'OUEST' | 'SUD'
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

interface Poste {
  trainingDomain: TrainingDomain | undefined
  jobTitle: string
  selectedMissions: string[]
  localisation: Localisation | undefined
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
  jobDescriptionOther: string
  softSkills: string[]
  softSkillsOther: string
  conditions: string
  additionalComments: string
  drivingLicense: 'OUI' | 'OPTIONNEL'
  experienceRequired: 'DEBUTANT' | 'OBLIGATOIRE'
  ageMin: string
  ageMax: string
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
  'Restauration rapide',
  'Station service',
  'Boulangerie / Pâtisserie',
  'Libre Service',
  'Enseignement de la conduite',
]

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
  trainingDomain: undefined,
  jobTitle: '',
  selectedMissions: [],
  localisation: undefined,
}

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onSuccess: () => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NeedsAnalysisModal({ entreprise, currentUser, onClose, onSuccess }: Props) {
  const [trainingDays, setTrainingDays] = useState<TrainingDaysState>({
    monday: 'OUI', tuesday: 'OUI', wednesday: 'OUI', thursday: 'OUI', friday: 'OUI',
  })
  const [postes, setPostes] = useState<Poste[]>([{ ...EMPTY_POSTE }])
  const [posteErrors, setPosteErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  // Quelle action a déclenché la soumission : télécharger le PDF ou l'envoyer en signature.
  const intentRef = useRef<'download' | 'sign'>('download')

  const { createNeedsAnalysis, result } = useCreateNeedsAnalysis()
  const { update: updateCompany } = useUpdateCompany()

  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      companyName:        entreprise.nom_commercial ?? '',
      companySiret:       entreprise.siret ?? '',
      companyAddress:     entreprise.adresse ?? '',
      companyPostalCode:  '',
      companyCommune:     '',
      legalRepName:       entreprise.representant_legal ?? '',
      legalRepFunction:   '',
      legalRepFunctionOther: '',
      legalRepPhone:      entreprise.telephone ?? '',
      legalRepEmail:      entreprise.email ?? '',
      isDifferentRecruitmentResponsible: false,
      recruitmentResponsibleName:     '',
      recruitmentResponsibleFunction: '',
      recruitmentResponsibleFunctionOther: '',
      recruitmentResponsiblePhone:    '',
      recruitmentResponsibleEmail:    '',
      companySectors:           [],
      companySectorOther:       '',
      opco:                     undefined,
      companyDescriptionOther:  '',
      jobDescriptionOther:      '',
      softSkills:               [],
      softSkillsOther:          '',
      conditions:               '',
      additionalComments:       '',
      drivingLicense:     undefined,
      experienceRequired: undefined,
      ageMin:             '',
      ageMax:             '',
      recruitmentMethod:  undefined,
      immersionPeriod:    undefined,
    },
  })

  const isDifferentResponsible = watch('isDifferentRecruitmentResponsible')
  const legalRepFunction       = watch('legalRepFunction')
  const responsibleFunction    = watch('recruitmentResponsibleFunction')
  const companySectors         = watch('companySectors') ?? []
  const softSkills             = watch('softSkills') ?? []
  const companyPostalCode      = watch('companyPostalCode')

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

  const setPostesCount = (count: number) => {
    setPostes((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ ...EMPTY_POSTE }))]
      }
      return prev.slice(0, count)
    })
  }

  const updatePoste = (index: number, patch: Partial<Poste>) => {
    setPostes((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const validatePostes = (): boolean => {
    const errs = postes.map((p) => {
      if (!p.trainingDomain) return 'Sélectionnez le domaine de formation.'
      if (!p.jobTitle) return 'Sélectionnez l\'intitulé de la formation.'
      if (p.selectedMissions.length === 0) return 'Sélectionnez au moins une mission.'
      if (!p.localisation) return 'Sélectionnez la localisation du poste.'
      return ''
    })
    setPosteErrors(errs)
    return errs.every((e) => !e)
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)

    if (!validatePostes()) {
      setSubmitError('Veuillez compléter tous les postes.')
      return
    }

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

    const response = await createNeedsAnalysis({
      companyID:          parseInt(entreprise.id),
      userID:             currentUser.id,
      legalRepFunction:   resolveFunction(data.legalRepFunction, data.legalRepFunctionOther),
      ...responsible,
      companySectors:     [...companySectors, ...(data.companySectorOther.trim() ? [data.companySectorOther.trim()] : [])],
      opco:               data.opco || null,
      companyDescription: data.companyDescriptionOther || null,
      positionsCount:     postes.length,
      positions:          postes.map((p) => ({
        trainingDomain:   p.trainingDomain,
        jobTitle:         p.jobTitle,
        selectedMissions: p.selectedMissions,
        localisation:     p.localisation,
      })),
      jobDescriptionMissions: [],
      jobDescriptionOther:    data.jobDescriptionOther || null,
      drivingLicense:         data.drivingLicense,
      experienceRequired:     data.experienceRequired,
      ageMin:                 data.ageMin ? Number(data.ageMin) : null,
      ageMax:                 data.ageMax ? Number(data.ageMax) : null,
      softSkills:             softSkillsFull,
      conditions:             data.conditions || null,
      additionalComments:     data.additionalComments || null,
      recruitmentMethod:      data.recruitmentMethod,
      immersionPeriod:        data.immersionPeriod,
      trainingDays:           trainingDaysJson,
    })

    if (response.error) { setSubmitError(response.error.message); return }

    const createdId = response.data?.createNeedsAnalysis?.id
    if (createdId) {
      if (intentRef.current === 'sign') {
        // L'AB est créée (BROUILLON). On ouvre l'aperçu avant l'envoi DocuSeal :
        // l'envoi réel n'a lieu qu'à la confirmation dans SignaturePreviewModal.
        setPreviewId(createdId)
        return
      }
      try {
        await downloadPdf(createdId)
      } catch {
        setSubmitError('AB enregistrée, mais le téléchargement du PDF a échoué. Réessayez depuis la liste.')
        return
      }
    }

    onSuccess()
    onClose()
  }

  // Confirmation de l'aperçu → envoi en signature réel, puis fermeture.
  const handleConfirmSignature = async () => {
    if (previewId == null) return
    await sendForSignature(previewId)
    onSuccess()
    onClose()
  }

  const sendForSignature = async (id: number) => {
    const token = useAuthStore.getState().token
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/needs-analysis/${id}/sign`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || `Envoi signature échoué (${res.status})`)
    }
  }

  const downloadPdf = async (id: number) => {
    const token = useAuthStore.getState().token
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/needs-analysis/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
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
            onSuccess()
            onClose()
          }}
        />
      )}
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
                />

                <InputField id="companySectorOther" label="Autre secteur d'activité (optionnel)"
                  placeholder="Précisez un autre secteur…"
                  {...register('companySectorOther')} />

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

                <NumberStepper
                  label="Nombre de poste(s) à pourvoir *"
                  value={postes.length}
                  onChange={setPostesCount}
                  max={10}
                  required
                />

                {postes.map((poste, index) => (
                  <div key={index} className="flex flex-col gap-5 rounded-xl border border-gray-100 bg-white p-4">
                    {postes.length > 1 && (
                      <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                        <Briefcase size={14} className="text-blue" />
                        Poste {index + 1}
                      </p>
                    )}

                    <RadioGroup label="Domaine de formation *"
                      options={[
                        { value: 'SECRETARIAT' as const, label: 'Secrétariat (Administratif)' },
                        { value: 'VENTE' as const,       label: 'Vente (Commercial)' },
                      ]}
                      value={poste.trainingDomain}
                      onChange={(v) => updatePoste(index, { trainingDomain: v, jobTitle: '', selectedMissions: [] })}
                      required />

                    {poste.trainingDomain && (
                      <SelectField
                        id={`jobTitle-${index}`}
                        label="Intitulé de la formation *"
                        options={JOB_TITLES_BY_DOMAIN[poste.trainingDomain]}
                        required
                        value={poste.jobTitle}
                        onChange={(e) => updatePoste(index, { jobTitle: e.target.value, selectedMissions: [] })}
                      />
                    )}

                    {poste.jobTitle && poste.trainingDomain && MISSIONS[poste.trainingDomain]?.[poste.jobTitle] && (
                      <div className="flex flex-col gap-2">
                        <CheckboxGroup
                          label={`Missions à confier à l'apprenti — ${poste.jobTitle}`}
                          options={MISSIONS[poste.trainingDomain][poste.jobTitle]}
                          selected={poste.selectedMissions}
                          onChange={(v) => updatePoste(index, { selectedMissions: v })}
                          columns={2}
                        />
                        {poste.selectedMissions.length > 0 && (
                          <p className="text-xs text-blue">
                            {poste.selectedMissions.length} mission{poste.selectedMissions.length > 1 ? 's' : ''} sélectionnée{poste.selectedMissions.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}

                    <RadioGroup label="Localisation du poste *"
                      options={[
                        { value: 'NORD' as const,  label: 'Nord' },
                        { value: 'OUEST' as const, label: 'Ouest' },
                        { value: 'SUD' as const,   label: 'Sud' },
                      ]}
                      value={poste.localisation}
                      onChange={(v) => updatePoste(index, { localisation: v })}
                      required />

                    {posteErrors[index] && <FieldError message={posteErrors[index]} />}
                  </div>
                ))}

                <TextareaField id="jobDescriptionOther" label="Description complémentaire" optional rows={3}
                  placeholder="Responsabilités spécifiques, contexte…"
                  {...register('jobDescriptionOther')} />

                <CheckboxGroup
                  label="Compétences et savoir-être attendus"
                  options={SOFT_SKILLS_LIST}
                  selected={softSkills}
                  onChange={(v) => setValue('softSkills', v)}
                  columns={2}
                />
                <InputField id="softSkillsOther" label="Autre compétence (optionnel)"
                  placeholder="Ex : maîtrise d'un logiciel spécifique…"
                  {...register('softSkillsOther')} />

                <TextareaField id="conditions" label="Conditions du poste" optional rows={3}
                  placeholder="Horaires, télétravail, avantages, véhicule…"
                  {...register('conditions')} />

                <TextareaField id="additionalComments" label="Commentaires supplémentaires" optional rows={2}
                  placeholder="Salaire, avantages, informations spécifiques…"
                  {...register('additionalComments')} />
              </section>

              {/* ── Exigences de l'apprenti ──────────────────────────────────── */}
              <section className="flex flex-col gap-5">
                <SectionTitle>Exigences de l'apprenti</SectionTitle>

                <input type="hidden" {...register('drivingLicense',     { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('experienceRequired', { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('recruitmentMethod',  { required: 'Champ obligatoire' })} />
                <input type="hidden" {...register('immersionPeriod',    { required: 'Champ obligatoire' })} />

                <RadioGroup label="Permis de conduire B *"
                  options={[{ value: 'OUI' as const, label: 'Obligatoire' }, { value: 'OPTIONNEL' as const, label: 'Optionnel' }]}
                  value={watch('drivingLicense')}
                  onChange={(v) => setValue('drivingLicense', v, { shouldValidate: true })}
                  error={errors.drivingLicense?.message} required />

                <RadioGroup label="Expérience requise *"
                  options={[{ value: 'DEBUTANT' as const, label: 'Débutant accepté' }, { value: 'OBLIGATOIRE' as const, label: 'Expérience obligatoire' }]}
                  value={watch('experienceRequired')}
                  onChange={(v) => setValue('experienceRequired', v, { shouldValidate: true })}
                  error={errors.experienceRequired?.message} required />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Âge souhaité <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField id="ageMin" label="De (ans)" type="number" min={15} max={99} placeholder="18"
                      error={errors.ageMin?.message}
                      {...register('ageMin', {
                        validate: (v) => !v || (Number(v) >= 15 && Number(v) <= 99) || 'Âge invalide',
                      })} />
                    <InputField id="ageMax" label="À (ans)" type="number" min={15} max={99} placeholder="29"
                      error={errors.ageMax?.message}
                      {...register('ageMax', {
                        validate: (v, form) => {
                          if (!v) return true
                          if (Number(v) < 15 || Number(v) > 99) return 'Âge invalide'
                          if (form.ageMin && Number(v) < Number(form.ageMin)) return 'Doit être ≥ âge min'
                          return true
                        },
                      })} />
                  </div>
                </div>

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
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
