import { useState } from 'react'
import StepperNav    from '../components/AB/StepperNav'
import Step1Entreprise, { validateStep1 } from '../components/AB/Step1Entreprise'
import Step2Poste,       { validateStep2 } from '../components/AB/Step2Poste'
import Step3Apprenti,    { validateStep3 } from '../components/AB/Step3Apprenti'
import Step4Recrutement, { validateStep4 } from '../components/AB/Step4Recrutement'
import Step5Signature,   { validateStep5 } from '../components/AB/Step5Signature'
import { submitAB, sendToYousign } from '../services/abService'
import { INITIAL_STATE } from '../types/ab'
import type { ABFormState } from '../types/ab'

const C = {
  blue:   '#1A1AE6',
  violet: '#6B2FD9',
  night:  '#1A1A2E',
  grey:   '#F2F2F2',
  white:  '#FFFFFF',
  error:  '#E91E8C',
  cyan:   '#00BCD4',
}

const VALIDATORS = [validateStep1, validateStep2, validateStep3, validateStep4, validateStep5]

const STEP_TITLES = [
  "Identité de l'entreprise",
  'Le poste',
  "L'apprenti",
  'Recrutement',
  'Signature et soumission',
]

export default function FormulaireAB() {
  const [state,       setState]       = useState<ABFormState>(INITIAL_STATE)
  const [step,        setStep]        = useState(1)
  const [errors,      setErrors]      = useState<string[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  function patch(update: Partial<ABFormState>) {
    setState(prev => ({ ...prev, ...update }))
    setErrors([])
  }

  function goNext() {
    const errs = VALIDATORS[step - 1](state)
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    setStep(s => Math.min(s + 1, 5))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPrev() {
    setErrors([])
    setStep(s => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    const errs = validateStep5(state)
    if (errs.length) { setErrors(errs); return }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitAB(state)        // validation serveur
      await sendToYousign(state)   // PDF + YouSign → DB après signature
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: C.grey, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: C.white, borderRadius: 12, padding: '48px 56px', maxWidth: 520, textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: C.night, fontSize: 22, margin: '0 0 12px' }}>Analyse de Besoin soumise !</h2>
          <p style={{ color: '#555', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Vous allez recevoir un email pour signer votre Analyse de Besoin électroniquement via YouSign.
            <br /><br />
            Une fois signée, notre équipe RH prendra en charge votre demande et vous contactera dans les meilleurs délais.
          </p>
          <div style={{
            marginTop: 24, padding: '12px 16px', borderRadius: 6,
            background: 'rgba(0,188,212,0.08)', border: `1px solid ${C.cyan}`, fontSize: 13, color: '#333',
          }}>
            💙 Merci de faire confiance à <strong>Disciplina</strong> pour votre recrutement par apprentissage.
          </div>
        </div>
      </div>
    )
  }

  const stepComponents: Record<number, React.ReactNode> = {
    1: <Step1Entreprise  state={state} onChange={patch} />,
    2: <Step2Poste       state={state} onChange={patch} />,
    3: <Step3Apprenti    state={state} onChange={patch} />,
    4: <Step4Recrutement state={state} onChange={patch} />,
    5: <Step5Signature   state={state} onChange={patch} />,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.grey, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: C.night, padding: '14px 40px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: C.blue,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, color: C.white, fontSize: 16,
        }}>D</div>
        <div>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 16 }}>Disciplina</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Analyse de Besoin</div>
        </div>
      </div>

      <StepperNav currentStep={step} />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 80px' }}>
        <h2 style={{ color: C.night, fontSize: 20, margin: '0 0 24px', fontWeight: 700 }}>
          Étape {step} — {STEP_TITLES[step - 1]}
        </h2>

        {stepComponents[step]}

        {errors.length > 0 && (
          <div style={{
            background: 'rgba(233,30,140,0.07)', border: `1px solid ${C.error}`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 20,
          }}>
            <p style={{ color: C.error, fontWeight: 600, margin: '0 0 6px', fontSize: 14 }}>
              Veuillez corriger les erreurs suivantes :
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e, i) => (
                <li key={i} style={{ color: C.error, fontSize: 13, marginBottom: 2 }}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {submitError && (
          <div style={{
            background: 'rgba(233,30,140,0.07)', border: `1px solid ${C.error}`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 20,
            color: C.error, fontSize: 14,
          }}>
            {submitError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            style={{
              padding: '12px 28px', fontSize: 14, borderRadius: 6, cursor: step === 1 ? 'default' : 'pointer',
              border: '1px solid #ddd', background: '#fff', color: '#555',
              opacity: step === 1 ? 0.4 : 1, fontWeight: 500,
            }}
          >
            ← Précédent
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={goNext}
              style={{
                padding: '12px 32px', fontSize: 14, borderRadius: 6, cursor: 'pointer',
                background: C.blue, color: C.white, border: 'none', fontWeight: 700,
                boxShadow: '0 2px 8px rgba(26,26,230,0.3)',
              }}
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '12px 36px', fontSize: 14, borderRadius: 6,
                cursor: submitting ? 'wait' : 'pointer',
                background: submitting ? '#aaa' : `linear-gradient(135deg, ${C.blue}, ${C.violet})`,
                color: C.white, border: 'none', fontWeight: 700,
                boxShadow: submitting ? 'none' : '0 2px 12px rgba(107,47,217,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {submitting ? 'Envoi en cours…' : '✍️ Soumettre et signer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
