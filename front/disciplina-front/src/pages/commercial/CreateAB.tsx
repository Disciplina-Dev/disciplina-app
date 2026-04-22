import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react'
import type { Entreprise } from '@/types/entreprise'
import type { ABFormData } from '@/types/ab'
import { useCurrentUser } from '@/store/authStore'
import type { AppUser } from '@/store/authStore'
import Button from '@/components/ui/Button'
import {
  StepIndicator, NavButtons,
  Step1, Step2, Step3, Step4, Step5Recap,
} from '@/features/abEntreprise/ABFormSteps'

const API_BASE = 'http://localhost:4000'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAddress(addr: string | null) {
  if (!addr) return { adresse_siege: '', code_postal: '', commune: '' }
  const match = addr.match(/^(.*?),?\s*(\d{5})\s+([^,]+?)(?:\s*,.*)?$/)
  if (match) {
    return {
      adresse_siege: match[1].trim().replace(/,\s*$/, ''),
      code_postal: match[2],
      commune: match[3].trim(),
    }
  }
  return { adresse_siege: addr, code_postal: '', commune: '' }
}


function buildInitialData(e: Entreprise, user: AppUser): ABFormData {
  const { adresse_siege, code_postal, commune } = parseAddress(e.adresse)
  return {
    campus: user.campus,
    raison_sociale: e.nom_commercial ?? '',
    siret: e.siret ?? '',
    adresse_siege,
    code_postal,
    commune,
    rl_nom: e.representant_legal ?? '',
    rl_fonction: '',
    rl_telephone: e.telephone ?? '',
    rl_email: e.email ?? '',
    rr_same_as_rl: false,
    rr_nom: '',
    rr_fonction: '',
    rr_telephone: '',
    rr_email: '',
    presentation_activite: '',
    nb_postes: '',
    localisation_poste: commune,
    domaine: '',
    intitule_poste: '',
    missions: [],
    autres_missions: '',
    profils_recherches: '',
    competences: '',
    commentaires: '',
    niveau_formation: '',
    permis: '',
    experience: '',
    age_exige: '',
    methode_recrutement: '',
    pmsmp: '',
    jours_formation: {
      lundi: 'Non',
      mardi: 'Non',
      mercredi: 'Non',
      jeudi: 'Non',
      vendredi: 'Non',
    },
  }
}

// ─── Step 5 local (recap + submit) ───────────────────────────────────────────

function Step5({ data, certified, onCertify, onSubmit, submitting, error }: {
  data: ABFormData
  certified: boolean
  onCertify: (v: boolean) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  return (
    <div className="space-y-5">
      <Step5Recap data={data} />
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={certified} onChange={(e) => onCertify(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-blue" />
          <span className="text-[13px] text-gray-700 leading-snug">
            Je certifie que les informations renseignées sont exactes et complètes.
          </span>
        </label>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={onSubmit} isLoading={submitting} disabled={!certified} className="w-full justify-center">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Valider l'Analyse de Besoin
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CreateAB() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useCurrentUser()
  const state = location.state as { entreprise?: Entreprise } | null
  const entreprise = state?.entreprise

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<ABFormData>(() =>
    buildInitialData(entreprise ?? ({} as Entreprise), currentUser)
  )
  const [certified, setCertified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)

  if (!entreprise) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-gray-300" />
        <p className="text-[15px] font-semibold text-gray-900">Aucune entreprise sélectionnée</p>
        <Button variant="secondary" onClick={() => navigate('/commercial/portefeuille')}>
          Retour au portefeuille
        </Button>
      </div>
    )
  }

  const update = (partial: Partial<ABFormData>) =>
    setFormData((prev) => ({ ...prev, ...partial }))

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!formData.raison_sociale) return 'La raison sociale est requise.'
      if (!formData.siret) return 'Le SIRET est requis.'
      if (!formData.adresse_siege || !formData.code_postal || !formData.commune)
        return "L'adresse complète (rue, code postal, commune) est requise."
      if (!formData.rl_nom || !formData.rl_fonction || !formData.rl_telephone || !formData.rl_email)
        return 'Tous les champs du représentant légal sont requis.'
    }
    if (s === 2) {
      if (!formData.presentation_activite) return "La présentation de l'activité est requise."
      if (!formData.nb_postes) return 'Le nombre de postes est requis.'
      if (!formData.localisation_poste) return 'La localisation du poste est requise.'
      if (!formData.domaine) return 'Veuillez sélectionner un domaine de formation.'
      if (!formData.intitule_poste) return 'Veuillez sélectionner un intitulé de poste.'
      if (!formData.profils_recherches) return 'Les profils recherchés sont requis.'
      if (!formData.competences) return 'Les compétences requises sont obligatoires.'
    }
    if (s === 3) {
      if (!formData.niveau_formation || !formData.permis || !formData.experience ||
        !formData.age_exige || !formData.methode_recrutement || !formData.pmsmp)
        return 'Tous les champs de cette étape sont requis.'
    }
    return null
  }

  const goNext = () => {
    const err = validateStep(step)
    if (err) { setStepError(err); return }
    setStepError(null)
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setStepError(null)
    setStep((s) => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!certified) {
      setSubmitError("Vous devez certifier l'exactitude des informations.")
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API_BASE}/api/ab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entreprise_id: parseInt(entreprise.id), ...formData }),
      })
      if (!res.ok) throw new Error()
      navigate('/commercial/analyses-besoin', {
        state: { successMessage: "Analyse de besoin créée avec succès." },
      })
    } catch {
      setSubmitError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">
            Nouvelle Analyse de Besoin
          </p>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-gray-900">
            {entreprise.nom_commercial ?? 'Entreprise'}
          </h1>
        </div>

        <StepIndicator current={step} />

        {stepError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {stepError}
          </div>
        )}

        {step === 1 && <Step1 data={formData} onChange={update} />}
        {step === 2 && <Step2 data={formData} onChange={update} />}
        {step === 3 && <Step3 data={formData} onChange={update} />}
        {step === 4 && <Step4 data={formData} onChange={update} />}
        {step === 5 && (
          <Step5 data={formData} certified={certified} onCertify={setCertified}
            onSubmit={handleSubmit} submitting={submitting} error={submitError} />
        )}

        {step < 5 && <NavButtons onBack={step > 1 ? goBack : undefined} onNext={goNext} />}
        {step === 5 && (
          <div className="pt-6 mt-2 border-t border-gray-100">
            <Button variant="secondary" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={goBack}>
              Précédent
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
