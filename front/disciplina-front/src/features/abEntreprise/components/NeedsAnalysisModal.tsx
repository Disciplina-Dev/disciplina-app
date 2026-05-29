import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Car,
  Clock,
  Award,
  AlertCircle,
  Building,
  ClipboardList
} from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import type { AppUser } from '@/store/authStore'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { useCreateNeedsAnalysis } from '@/graphql/hooks'

interface Props {
  entreprise: Entreprise
  currentUser: AppUser
  onClose: () => void
  onSuccess: () => void
}

const STEPS = [
  { id: 1, name: 'Identité & Contact', description: 'Coordonnées de l\'entreprise' },
  { id: 2, name: 'Poste & Missions', description: 'Description des tâches' },
  { id: 3, name: 'Profil recherché', description: 'Exigences candidat' },
  { id: 4, name: 'Calendrier', description: 'Rythme & Présence' },
  { id: 5, name: 'Validation', description: 'Engagement & Signature' }
]

const STANDARD_JOBS: Record<'VENTE' | 'SECRETARIAT', string[]> = {
  VENTE: [
    'Conseiller de Vente',
    'Négociateur Technico-Commercial',
    'Manager d\'Unité Marchande'
  ],
  SECRETARIAT: [
    'Secrétaire Assistant',
    'Assistant de Direction'
  ]
}

const STANDARD_MISSIONS: Record<string, string[]> = {
  'Conseiller de Vente': [
    'Accueil et orientation des clients',
    'Vente active de produits et services associés',
    'Mise en valeur des produits en rayon (merchandising)',
    'Gestion des stocks, réception et réapprovisionnement',
    'Gestion des encaissements et traitement des réclamations'
  ],
  'Négociateur Technico-Commercial': [
    'Prospection téléphonique et physique de nouveaux clients',
    'Négociation commerciale complexe et élaboration d\'offres',
    'Établissement et suivi des propositions techniques',
    'Gestion, fidélisation et développement du portefeuille client'
  ],
  'Manager d\'Unité Marchande': [
    'Gestion administrative et animation de l\'équipe commerciale',
    'Pilotage et analyse des indicateurs de performance commerciale',
    'Mise en œuvre d\'actions marketing locales et merchandising',
    'Gestion financière, budgétaire et rentabilité de l\'unité'
  ],
  'Secrétaire Assistant': [
    'Accueil physique et téléphonique des visiteurs',
    'Gestion administrative des courriers et messageries électroniques',
    'Saisie informatique de données et traitement de dossiers',
    'Organisation matérielle des réunions, agendas et déplacements'
  ],
  'Assistant de Direction': [
    'Assistance administrative quotidienne d\'un ou plusieurs dirigeants',
    'Filtrage des communications et gestion d\'agendas complexes',
    'Préparation des réunions stratégiques et rédaction des PV',
    'Prise en charge de dossiers ou projets internes spécifiques'
  ]
}

const WEEKDAYS = [
  { id: 'monday', label: 'Lundi' },
  { id: 'tuesday', label: 'Mardi' },
  { id: 'wednesday', label: 'Mercredi' },
  { id: 'thursday', label: 'Jeudi' },
  { id: 'friday', label: 'Vendredi' }
]

export default function NeedsAnalysisModal({ entreprise, currentUser, onClose, onSuccess }: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // GraphQL Hook
  const { createNeedsAnalysis, result: mutationResult } = useCreateNeedsAnalysis()

  // Form State
  const [form, setForm] = useState({
    companyID: parseInt(entreprise.id) || 0,
    userID: currentUser.id || 0,
    recruitmentResponsibleName: '',
    recruitmentResponsiblePhone: '',
    recruitmentResponsibleEmail: '',
    positionsCount: 1,
    localisation: 'NORD' as 'NORD' | 'OUEST' | 'SUD',
    trainingDomain: 'VENTE' as 'VENTE' | 'SECRETARIAT',
    jobTitle: 'Conseiller de Vente',
    customJobTitle: '',
    selectedMissions: [] as string[],
    otherMissions: '',
    educationLevel: 'BAC' as 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3',
    drivingLicense: 'OPTIONNEL' as 'OUI' | 'OPTIONNEL',
    experienceRequired: 'DEBUTANT' as 'DEBUTANT' | 'OBLIGATOIRE',
    ageRequirements: [] as string[],
    softSkills: '',
    recruitmentMethod: 'PRESELECTION' as 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW',
    immersionPeriod: 'A_DISCUTER' as 'OUI' | 'NON' | 'A_DISCUTER',
    trainingDays: {
      monday: ['MATIN', 'APRES_MIDI'],
      tuesday: ['MATIN', 'APRES_MIDI'],
      wednesday: ['MATIN', 'APRES_MIDI'],
      thursday: ['MATIN', 'APRES_MIDI'],
      friday: ['MATIN', 'APRES_MIDI']
    } as Record<string, string[]>
  })

  // Watch trainingDomain changes to pre-load default job
  useEffect(() => {
    const defaultJob = STANDARD_JOBS[form.trainingDomain][0]
    setForm((prev) => ({
      ...prev,
      jobTitle: defaultJob,
      customJobTitle: '',
      selectedMissions: STANDARD_MISSIONS[defaultJob] || []
    }))
  }, [form.trainingDomain])

  // Watch jobTitle changes to pre-load default missions
  useEffect(() => {
    if (form.jobTitle && form.jobTitle !== 'AUTRE') {
      setForm((prev) => ({
        ...prev,
        selectedMissions: STANDARD_MISSIONS[form.jobTitle] || []
      }))
    } else {
      setForm((prev) => ({ ...prev, selectedMissions: [] }))
    }
  }, [form.jobTitle])

  const handleNext = () => {
    // Basic validation
    if (currentStep === 1) {
      if (!form.recruitmentResponsibleName.trim()) {
        setErrorMsg('Veuillez renseigner le nom du responsable du recrutement.')
        return
      }
      if (!form.recruitmentResponsibleEmail.trim()) {
        setErrorMsg('Veuillez renseigner l\'email du responsable.')
        return
      }
    }
    if (currentStep === 2) {
      const finalJob = form.jobTitle === 'AUTRE' ? form.customJobTitle : form.jobTitle
      if (!finalJob.trim()) {
        setErrorMsg('Veuillez préciser l\'intitulé du poste recherché.')
        return
      }
    }

    setErrorMsg(null)
    setCurrentStep((prev) => Math.min(prev + 1, 5))
  }

  const handlePrev = () => {
    setErrorMsg(null)
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const toggleMission = (mission: string) => {
    setForm((prev) => {
      const selected = prev.selectedMissions.includes(mission)
        ? prev.selectedMissions.filter((m) => m !== mission)
        : [...prev.selectedMissions, mission]
      return { ...prev, selectedMissions: selected }
    })
  }

  const toggleAgeRequirement = (age: string) => {
    setForm((prev) => {
      const ages = prev.ageRequirements.includes(age)
        ? prev.ageRequirements.filter((a) => a !== age)
        : [...prev.ageRequirements, age]
      return { ...prev, ageRequirements: ages }
    })
  }

  const toggleTrainingDay = (day: string, period: 'MATIN' | 'APRES_MIDI') => {
    setForm((prev) => {
      const currentPeriods = prev.trainingDays[day] || []
      const newPeriods = currentPeriods.includes(period)
        ? currentPeriods.filter((p) => p !== period)
        : [...currentPeriods, period]
      return {
        ...prev,
        trainingDays: {
          ...prev.trainingDays,
          [day]: newPeriods
        }
      }
    })
  }

  const handleSubmit = async () => {
    setErrorMsg(null)
    const finalJobTitle = form.jobTitle === 'AUTRE' ? form.customJobTitle : form.jobTitle

    const input = {
      companyID: form.companyID,
      userID: form.userID,
      recruitmentResponsibleName: form.recruitmentResponsibleName,
      recruitmentResponsiblePhone: form.recruitmentResponsiblePhone,
      recruitmentResponsibleEmail: form.recruitmentResponsibleEmail,
      positionsCount: form.positionsCount,
      localisation: form.localisation,
      trainingDomain: form.trainingDomain,
      jobTitle: finalJobTitle,
      selectedMissions: form.selectedMissions,
      otherMissions: form.otherMissions,
      educationLevel: form.educationLevel,
      drivingLicense: form.drivingLicense,
      experienceRequired: form.experienceRequired,
      ageRequirements: form.ageRequirements,
      softSkills: form.softSkills,
      recruitmentMethod: form.recruitmentMethod,
      immersionPeriod: form.immersionPeriod,
      trainingDays: JSON.stringify(form.trainingDays),
      status: 'BROUILLON'
    }

    try {
      const res = await createNeedsAnalysis(input)
      if (res.error) {
        setErrorMsg(res.error.message || 'Une erreur est survenue lors de la sauvegarde.')
      } else {
        setIsSubmitted(true)
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Une erreur inattendue est survenue.')
    }
  }

  const activePercent = ((currentStep - 1) / 4) * 100

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-blue/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue/10 text-blue">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Nouvelle Analyse du Besoin (AB)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Rédiger les besoins en recrutement pour {entreprise.nom_commercial}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-50 bg-gray-50/50">
          <div className="relative w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue to-blue-dark transition-all duration-300 ease-out"
              style={{ width: `${activePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((step) => {
              const isActive = step.id === currentStep
              const isCompleted = step.id < currentStep
              return (
                <button
                  key={step.id}
                  disabled={step.id > currentStep && !isCompleted}
                  onClick={() => setCurrentStep(step.id)}
                  className="flex flex-col items-center gap-1 focus:outline-none disabled:cursor-not-allowed group"
                >
                  <span
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all border shadow-sm',
                      isActive
                        ? 'bg-blue border-blue text-white ring-4 ring-blue/10 scale-110'
                        : isCompleted
                        ? 'bg-success/10 border-success text-success'
                        : 'bg-white border-gray-200 text-gray-400 group-hover:border-gray-300 group-hover:text-gray-600'
                    ].join(' ')}
                  >
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                  </span>
                  <span
                    className={[
                      'hidden md:inline text-[10px] font-medium tracking-wide uppercase',
                      isActive ? 'text-blue font-bold' : isCompleted ? 'text-success' : 'text-gray-400'
                    ].join(' ')}
                  >
                    {step.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex gap-2 items-center rounded-lg bg-danger/5 p-3 border border-danger/10 text-danger text-xs animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Form Body Container */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-300">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success mb-4 ring-8 ring-success/5">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h3 className="text-lg font-bold text-gray-900">Analyse envoyée pour signature !</h3>
              <p className="text-sm text-gray-500 max-w-sm mt-1">Le document PDF a été généré et la procédure Yousign a été lancée pour le représentant. Redirection...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* STEP 1: IDENTITY & CONTACT */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                      <Building className="h-3.5 w-3.5 text-gray-400" />
                      Données de l'entreprise (Lues depuis la base)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-1">
                      <div>
                        <span className="text-xs text-gray-400 block font-medium">Raison sociale</span>
                        <span className="text-gray-800 font-medium">{entreprise.nom_commercial ?? '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block font-medium">SIRET</span>
                        <span className="text-gray-800 font-mono">{entreprise.siret ?? '-'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs text-gray-400 block font-medium">Adresse</span>
                        <span className="text-gray-800">{entreprise.adresse ?? '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block font-medium">Représentant légal</span>
                        <span className="text-gray-800 font-medium">{entreprise.representant_legal ?? '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Responsable du Recrutement</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="Nom complet du Responsable *"
                        id="recruitmentResponsibleName"
                        placeholder="Ex: Sophie Martin"
                        icon={<User className="h-4 w-4" />}
                        value={form.recruitmentResponsibleName}
                        onChange={(e) => setForm({ ...form, recruitmentResponsibleName: e.target.value })}
                      />
                      <InputField
                        label="Numéro de téléphone"
                        id="recruitmentResponsiblePhone"
                        placeholder="Ex: 06 92 12 34 56"
                        icon={<Phone className="h-4 w-4" />}
                        value={form.recruitmentResponsiblePhone}
                        onChange={(e) => setForm({ ...form, recruitmentResponsiblePhone: e.target.value })}
                      />
                      <InputField
                        label="Adresse email de contact *"
                        id="recruitmentResponsibleEmail"
                        type="email"
                        placeholder="Ex: s.martin@entreprise.com"
                        icon={<Mail className="h-4 w-4" />}
                        value={form.recruitmentResponsibleEmail}
                        onChange={(e) => setForm({ ...form, recruitmentResponsibleEmail: e.target.value })}
                      />
                      <InputField
                        label="Nombre de postes à pourvoir *"
                        id="positionsCount"
                        type="number"
                        min="1"
                        value={form.positionsCount}
                        onChange={(e) => setForm({ ...form, positionsCount: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-sm font-medium text-gray-700">Zone Géographique de l'emploi *</label>
                      <div className="grid grid-cols-3 gap-3 mt-1">
                        {(['NORD', 'OUEST', 'SUD'] as const).map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setForm({ ...form, localisation: loc })}
                            className={[
                              'flex py-3 px-4 rounded-xl border text-sm font-semibold justify-center transition-all items-center gap-2 shadow-sm',
                              form.localisation === loc
                                ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            ].join(' ')}
                          >
                            <MapPin className="h-4 w-4 shrink-0" />
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: POSITION & MISSIONS */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Filière / Domaine d'apprentissage *</label>
                    <div className="grid grid-cols-2 gap-4 mt-1">
                      {(['VENTE', 'SECRETARIAT'] as const).map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => setForm({ ...form, trainingDomain: dom })}
                          className={[
                            'flex flex-col p-4 rounded-xl border text-left transition-all shadow-sm items-start gap-1.5',
                            form.trainingDomain === dom
                              ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          ].join(' ')}
                        >
                          <Briefcase className="h-5 w-5 mb-0.5 text-blue" />
                          <span className="font-bold text-sm text-gray-900">{dom === 'VENTE' ? 'Commerce & Vente' : 'Secrétariat & Gestion'}</span>
                          <span className="text-xs text-gray-400">Titres Pro CFA Disciplina</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">Métiers cibles de la formation *</label>
                    <select
                      id="jobTitle"
                      value={form.jobTitle}
                      onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-800 outline-none focus:border-blue transition-colors"
                    >
                      {STANDARD_JOBS[form.trainingDomain].map((job) => (
                        <option key={job} value={job}>
                          {job}
                        </option>
                      ))}
                      <option value="AUTRE">-- Autre métier (saisir manuellement) --</option>
                    </select>
                  </div>

                  {form.jobTitle === 'AUTRE' && (
                    <InputField
                      label="Saisir l'intitulé exact du poste *"
                      id="customJobTitle"
                      placeholder="Ex: Assistant Import-Export"
                      value={form.customJobTitle}
                      onChange={(e) => setForm({ ...form, customJobTitle: e.target.value })}
                    />
                  )}

                  {/* Dynamic Missions checklist */}
                  {form.jobTitle !== 'AUTRE' && (
                    <div className="space-y-2 mt-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Missions types associées à la fiche métier</label>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1 border border-gray-50 rounded-xl p-3 bg-gray-50/20">
                        {STANDARD_MISSIONS[form.jobTitle]?.map((mission) => {
                          const isSelected = form.selectedMissions.includes(mission)
                          return (
                            <button
                              key={mission}
                              type="button"
                              onClick={() => toggleMission(mission)}
                              className={[
                                'flex w-full items-start gap-3 rounded-lg border p-2.5 text-left text-xs transition-all shadow-sm',
                                isSelected
                                  ? 'bg-blue/5 border-blue text-blue font-medium'
                                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                              ].join(' ')}
                            >
                              <span
                                className={[
                                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                  isSelected ? 'bg-blue border-blue text-white' : 'bg-white border-gray-300'
                                ].join(' ')}
                              >
                                {isSelected && <CheckCircle2 className="h-3 w-3" />}
                              </span>
                              <span className="leading-normal">{mission}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label htmlFor="otherMissions" className="text-sm font-medium text-gray-700">Autres missions ou spécificités à préciser</label>
                    <textarea
                      id="otherMissions"
                      rows={3}
                      placeholder="Indiquez ici les détails d'intégration, outils logiciels spécifiques à maîtriser ou autres tâches..."
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-blue transition-colors"
                      value={form.otherMissions}
                      onChange={(e) => setForm({ ...form, otherMissions: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: APPRENTICE REQUIREMENTS */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Education level */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4 text-blue" />
                        Niveau d'études requis
                      </label>
                      <div className="flex flex-col gap-2 mt-1">
                        {([
                          { id: 'BAC', label: 'Baccalauréat / Niveau 4' },
                          { id: 'BAC_PLUS_2', label: 'Bac + 2 / BTS / Niveau 5' },
                          { id: 'BAC_PLUS_3', label: 'Bac + 3 / Bachelor / Niveau 6' }
                        ] as const).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setForm({ ...form, educationLevel: item.id })}
                            className={[
                              'flex py-2.5 px-3 rounded-lg border text-xs font-semibold justify-start transition-all items-center gap-2.5 shadow-sm',
                              form.educationLevel === item.id
                                ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            ].join(' ')}
                          >
                            <span className={['h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0', form.educationLevel === item.id ? 'bg-blue border-blue' : 'bg-white border-gray-300']}>
                              {form.educationLevel === item.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Driving license & Experience */}
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <Car className="h-4 w-4 text-blue" />
                          Permis de conduire B
                        </label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {(['OUI', 'OPTIONNEL'] as const).map((lic) => (
                            <button
                              key={lic}
                              type="button"
                              onClick={() => setForm({ ...form, drivingLicense: lic })}
                              className={[
                                'flex py-2.5 px-3 rounded-lg border text-xs font-semibold justify-center transition-all items-center gap-1.5 shadow-sm',
                                form.drivingLicense === lic
                                  ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                              ].join(' ')}
                            >
                              {lic === 'OUI' ? 'Obligatoire' : 'Optionnel / Non requis'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-blue" />
                          Expérience souhaitée
                        </label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {(['DEBUTANT', 'OBLIGATOIRE'] as const).map((exp) => (
                            <button
                              key={exp}
                              type="button"
                              onClick={() => setForm({ ...form, experienceRequired: exp })}
                              className={[
                                'flex py-2.5 px-3 rounded-lg border text-xs font-semibold justify-center transition-all items-center gap-1.5 shadow-sm',
                                form.experienceRequired === exp
                                  ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                              ].join(' ')}
                            >
                              {exp === 'DEBUTANT' ? 'Débutant accepté' : 'Expérience requise'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-blue" />
                      Tranches d'âge cibles de l'apprenti (Sélection multiple)
                    </label>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {['Moins de 18 ans', '18-25 ans', '26 ans et +'].map((age) => {
                        const isSelected = form.ageRequirements.includes(age)
                        return (
                          <button
                            key={age}
                            type="button"
                            onClick={() => toggleAgeRequirement(age)}
                            className={[
                              'flex py-3 px-2 rounded-xl border text-xs font-semibold justify-center transition-all items-center gap-2 shadow-sm',
                              isSelected
                                ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            ].join(' ')}
                          >
                            <span className={['h-3.5 w-3.5 border rounded flex items-center justify-center shrink-0 transition-colors', isSelected ? 'bg-blue border-blue text-white' : 'bg-white border-gray-300']}>
                              {isSelected && <CheckCircle2 className="h-2 w-2" />}
                            </span>
                            {age}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="softSkills" className="text-sm font-medium text-gray-700">Qualités et Soft Skills recherchées</label>
                    <textarea
                      id="softSkills"
                      rows={3}
                      placeholder="Ex: Autonomie, aisance relationnelle, ponctualité, esprit d'équipe, bonne présentation..."
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-blue transition-colors"
                      value={form.softSkills}
                      onChange={(e) => setForm({ ...form, softSkills: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: LOGISTICS & TRAINING DAYS */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Recruitment Method */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Méthode de recrutement souhaitée *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                      {([
                        { id: 'ALL_CV', label: 'Réception de tous les CV', description: 'L\'entreprise reçoit et traite directement tous les dossiers' },
                        { id: 'PRESELECTION', label: 'Présélection par le centre', description: 'Disciplina filtre les profils avant envoi' },
                        { id: 'PRE_INTERVIEW', label: 'Pré-entretien par le centre', description: 'Disciplina conduit un premier entretien' }
                      ] as const).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setForm({ ...form, recruitmentMethod: item.id })}
                          className={[
                            'flex flex-col items-start gap-1 p-3 rounded-xl border text-left text-xs font-semibold transition-all shadow-sm',
                            form.recruitmentMethod === item.id
                              ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-2">
                            <span className={['h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0', form.recruitmentMethod === item.id ? 'bg-blue border-blue' : 'bg-white border-gray-300'].join(' ')}>
                              {form.recruitmentMethod === item.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            {item.label}
                          </div>
                          <span className="text-[10px] font-normal text-gray-400 leading-normal mt-0.5">{item.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Période d'immersion préalable souhaitée ?</label>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {([
                        { id: 'OUI', label: 'Oui (Période PMSMP)' },
                        { id: 'NON', label: 'Non' },
                        { id: 'A_DISCUTER', label: 'À discuter / Négocier' }
                      ] as const).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setForm({ ...form, immersionPeriod: item.id })}
                          className={[
                            'flex py-3 px-2 rounded-xl border text-xs font-semibold justify-center transition-all items-center gap-2 shadow-sm text-center',
                            form.immersionPeriod === item.id
                              ? 'bg-blue/5 border-blue text-blue ring-2 ring-blue/5'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          ].join(' ')}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Weekly grid */}
                  <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <label className="text-sm font-medium text-gray-900 block">Jours de présence prévus en entreprise *</label>
                      <p className="text-xs text-gray-400 mt-0.5">Toggles : Vert = Présence en entreprise | Blanc = Journée en cours au CFA / Congé</p>
                    </div>

                    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Jour</th>
                            <th className="px-4 py-3 text-center">Matinée (08h00 - 12h00)</th>
                            <th className="px-4 py-3 text-center">Après-midi (13h00 - 17h00)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                          {WEEKDAYS.map((day) => {
                            const morningSelected = form.trainingDays[day.id]?.includes('MATIN')
                            const afternoonSelected = form.trainingDays[day.id]?.includes('APRES_MIDI')

                            return (
                              <tr key={day.id} className="hover:bg-gray-50/40 transition-colors">
                                <td className="px-4 py-3 font-semibold text-gray-700">{day.label}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleTrainingDay(day.id, 'MATIN')}
                                    className={[
                                      'mx-auto flex h-8 w-32 items-center justify-center rounded-lg border text-xs font-bold transition-all shadow-sm active:scale-95',
                                      morningSelected
                                        ? 'bg-success/15 border-success text-success font-extrabold'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                    ].join(' ')}
                                  >
                                    {morningSelected ? 'Entreprise' : 'CFA / Repos'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleTrainingDay(day.id, 'APRES_MIDI')}
                                    className={[
                                      'mx-auto flex h-8 w-32 items-center justify-center rounded-lg border text-xs font-bold transition-all shadow-sm active:scale-95',
                                      afternoonSelected
                                        ? 'bg-success/15 border-success text-success font-extrabold'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                    ].join(' ')}
                                  >
                                    {afternoonSelected ? 'Entreprise' : 'CFA / Repos'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: RECAPITULATIF, SIGNATURE & SUBMISSION */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm bg-gradient-to-br from-white via-white to-gray-50/50">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                      <ClipboardList className="h-4 w-4 text-blue" />
                      Récapitulatif de l'Analyse du Besoin
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-400 block font-medium">Poste recherché</span>
                        <span className="text-gray-900 font-bold text-sm">
                          {form.jobTitle === 'AUTRE' ? form.customJobTitle : form.jobTitle}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-medium">Nombre de poste(s) & Zone</span>
                        <span className="text-gray-900 font-semibold">{form.positionsCount} poste(s) ({form.localisation})</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-medium">Responsable Recrutement</span>
                        <span className="text-gray-900 font-medium">{form.recruitmentResponsibleName}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-medium">Contact Responsable</span>
                        <span className="text-gray-900">{form.recruitmentResponsibleEmail} / {form.recruitmentResponsiblePhone || '-'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-gray-400 block font-medium">Missions de l'apprenti ({form.selectedMissions.length} sélectionnée(s))</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {form.selectedMissions.map((m) => (
                            <span key={m} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-medium leading-tight">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-medium">Niveau requis & Permis</span>
                        <span className="text-gray-900 font-semibold">{form.educationLevel} (Permis B: {form.drivingLicense === 'OUI' ? 'Oui' : 'Optionnel'})</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-medium">Expérience attendue</span>
                        <span className="text-gray-900 font-semibold">{form.experienceRequired === 'DEBUTANT' ? 'Débutant accepté' : 'Expérience requise'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Premium Clause of Engagement */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                      <Award className="h-3.5 w-3.5 text-blue" />
                      Clause d'Engagement CFA (Réglementaire)
                    </div>
                    <div className="text-[11px] text-gray-600 leading-relaxed bg-white border border-gray-100 rounded-lg p-3 max-h-28 overflow-y-auto">
                      <strong>1. Conformité des Missions :</strong> L'entreprise s'engage à confier à l'apprenti des tâches et missions en stricte adéquation avec le référentiel d'activités du titre professionnel préparé auprès du CFA Disciplina.
                      <br /><br />
                      <strong>2. Tutorat & Accompagnement :</strong> L'entreprise désigne un maître d'apprentissage chargé de guider l'apprenti, de participer aux évaluations de progression en liaison avec le tuteur du CFA, et de faciliter sa réussite.
                      <br /><br />
                      <strong>3. Signature Électronique Yousign :</strong> Cette demande est initiée sous forme numérique via notre partenaire Yousign. Le document PDF complet et certifié eIDAS sera expédié par e-mail au représentant légal pour signature électronique contractuelle.
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border border-blue/15 bg-blue/5 p-3 text-left transition-all cursor-pointer hover:bg-blue/10">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue focus:ring-blue"
                      />
                      <div className="text-xs text-blue-dark leading-normal font-medium">
                        Je déclare sur l'honneur que l'entreprise accepte les conditions de collaboration, les clauses d'engagement ci-dessus et consent à l'évolution réglementaire des missions. *
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isSubmitted && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50/50">
            <div>
              {currentStep > 1 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                  onClick={handlePrev}
                >
                  Précédent
                </Button>
              ) : (
                <span />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Annuler
              </Button>
              {currentStep < 5 ? (
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                  onClick={handleNext}
                >
                  Suivant
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={handleSubmit}
                  isLoading={mutationResult.fetching}
                  disabled={!acceptedTerms}
                  className={!acceptedTerms ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Générer & Envoyer pour Signature
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
