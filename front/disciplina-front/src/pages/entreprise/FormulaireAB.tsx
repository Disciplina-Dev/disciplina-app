import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import type { ABFormData } from '@/types/ab'
import {
  StepIndicator, NavButtons,
  Step1, Step2, Step3, Step4, Step5Recap,
} from '@/features/abEntreprise/ABFormSteps'
import Button from '@/components/ui/Button'

const API_BASE = 'http://localhost:4000'

const EMPTY_FORM: ABFormData = {
  campus: '',
  raison_sociale: '', siret: '', adresse_siege: '', code_postal: '', commune: '',
  rl_nom: '', rl_fonction: '', rl_telephone: '', rl_email: '',
  rr_same_as_rl: false, rr_nom: '', rr_fonction: '', rr_telephone: '', rr_email: '',
  presentation_activite: '', nb_postes: '', localisation_poste: '',
  domaine: '', intitule_poste: '', missions: [], autres_missions: '',
  profils_recherches: '', competences: '', commentaires: '',
  niveau_formation: '', permis: '', experience: '', age_exige: '',
  methode_recrutement: '', pmsmp: '',
  jours_formation: { lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: '' },
}

function rowToFormData(ab: any): ABFormData {
  return {
    campus: ab.campus ?? '',
    raison_sociale: ab.raison_sociale ?? '',
    siret: ab.siret ?? '',
    adresse_siege: ab.adresse_siege ?? '',
    code_postal: ab.code_postal ?? '',
    commune: ab.commune ?? '',
    rl_nom: ab.rl_nom ?? '',
    rl_fonction: ab.rl_fonction ?? '',
    rl_telephone: ab.rl_telephone ?? '',
    rl_email: ab.rl_email ?? '',
    rr_same_as_rl: !!ab.rr_same_as_rl,
    rr_nom: ab.rr_nom ?? '',
    rr_fonction: ab.rr_fonction ?? '',
    rr_telephone: ab.rr_telephone ?? '',
    rr_email: ab.rr_email ?? '',
    presentation_activite: ab.presentation_activite ?? '',
    nb_postes: ab.nb_postes ?? '',
    localisation_poste: ab.localisation_poste ?? '',
    domaine: ab.domaine ?? '',
    intitule_poste: ab.intitule_poste ?? '',
    missions: Array.isArray(ab.missions) ? ab.missions : [],
    autres_missions: ab.autres_missions ?? '',
    profils_recherches: ab.profils_recherches ?? '',
    competences: ab.competences ?? '',
    commentaires: ab.commentaires ?? '',
    niveau_formation: ab.niveau_formation ?? '',
    permis: ab.permis ?? '',
    experience: ab.experience ?? '',
    age_exige: ab.age_exige ?? '',
    methode_recrutement: ab.methode_recrutement ?? '',
    pmsmp: ab.pmsmp ?? '',
    jours_formation: ab.jours_formation ?? { lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: '' },
  }
}

export default function FormulaireAB() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<ABFormData>(EMPTY_FORM)
  const [certified, setCertified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    fetch(`${API_BASE}/api/ab/${token}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null }
        return res.json()
      })
      .then((data) => {
        if (data) setFormData(rowToFormData(data))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const update = (partial: Partial<ABFormData>) =>
    setFormData((prev) => ({ ...prev, ...partial }))

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!formData.raison_sociale) return 'La raison sociale est requise.'
      if (!formData.siret) return 'Le SIRET est requis.'
      if (!formData.adresse_siege || !formData.code_postal || !formData.commune)
        return "L'adresse complète est requise."
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
      // 1. Sauvegarder les modifications
      const putRes = await fetch(`${API_BASE}/api/ab/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!putRes.ok) throw new Error()

      // 2. Déclencher PDF + YouSign
      const validerRes = await fetch(`${API_BASE}/api/ab/${token}/valider`, {
        method: 'POST',
      })
      if (!validerRes.ok) throw new Error()

      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <AlertCircle className="h-12 w-12 text-gray-300" />
        <p className="text-[18px] font-bold text-gray-900">Formulaire introuvable</p>
        <p className="text-[14px] text-gray-500 text-center max-w-sm">
          Ce lien est invalide ou a déjà été utilisé. Contactez votre conseiller Disciplina.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-[22px] font-extrabold text-gray-900">Formulaire validé !</p>
          <p className="text-[14px] text-gray-500 mt-2 max-w-sm">
            Vous allez recevoir un email pour signer électroniquement votre Analyse de Besoin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background, #f9fafb)' }}>
      {/* Header */}
      <div className="bg-blue px-6 py-5">
        <p className="text-white/60 text-[11px] font-semibold uppercase tracking-[0.15em]">Disciplina</p>
        <h1 className="text-white text-[20px] font-extrabold leading-tight mt-0.5">
          Analyse de Besoin
        </h1>
        {formData.raison_sociale && (
          <p className="text-white/80 text-[13px] mt-1">{formData.raison_sociale}</p>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <StepIndicator current={step} />

        {stepError && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {stepError}
          </div>
        )}

        {step === 1 && <Step1 data={formData} onChange={update} />}
        {step === 2 && <Step2 data={formData} onChange={update} />}
        {step === 3 && <Step3 data={formData} onChange={update} />}
        {step === 4 && <Step4 />}
        {step === 5 && (
          <div className="space-y-5">
            <Step5Recap data={formData} />
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-blue" />
                <span className="text-[13px] text-gray-700 leading-snug">
                  Je certifie que les informations renseignées sont exactes et complètes.
                </span>
              </label>
              {submitError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}
              <div className="mt-4">
                <Button onClick={handleSubmit} isLoading={submitting} disabled={!certified} className="w-full justify-center">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Valider et signer
                </Button>
              </div>
            </div>
          </div>
        )}

        {step < 5 && <NavButtons onBack={step > 1 ? goBack : undefined} onNext={goNext} />}
        {step === 5 && (
          <div className="pt-6 mt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={goBack}>Précédent</Button>
          </div>
        )}
      </div>
    </div>
  )
}
