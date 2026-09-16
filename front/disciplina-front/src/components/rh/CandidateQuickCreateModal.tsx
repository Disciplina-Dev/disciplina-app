import { useState, useEffect } from 'react'
import { User, X, AlertCircle, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import { candidateGraphqlClient } from '@/graphql/client'
import { CREATE_CANDIDATE, CHECK_CANDIDATE_EMAIL } from '@/graphql/queries'
import { TitleProfessionalType } from '@/types/candidate'

const CONSENT_VERSION = '2026-08-v1'

interface CandidateQuickCreateModalProps {
  prefill?: { fullName?: string; email?: string; phone?: string }
  onClose: () => void
  onSaved?: () => void
  onCreated?: (id: string) => void
}

export default function CandidateQuickCreateModal({
  prefill,
  onClose,
  onSaved,
  onCreated,
}: CandidateQuickCreateModalProps) {
  const [fullName, setFullName] = useState(prefill?.fullName ?? '')
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [phone, setPhone] = useState(prefill?.phone ?? '')
  const [consentDataProcessing, setConsentDataProcessing] = useState(false)
  const [consentDataSharing, setConsentDataSharing] = useState(false)
  const [consentAiProcessing, setConsentAiProcessing] = useState(false)
  const [consentPhotoProcessing, setConsentPhotoProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailDup, setEmailDup] = useState<{ fullName: string } | null>(null)

  // Live duplicate email check
  useEffect(() => {
    const e = email.trim()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setEmailDup(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await candidateGraphqlClient.query(
          CHECK_CANDIDATE_EMAIL,
          { email: e },
          { requestPolicy: 'network-only' },
        )
        const r = res.data?.candidateByEmail
        setEmailDup(r?.exists ? { fullName: r.fullName } : null)
      } catch {
        setEmailDup(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Le nom et prénom sont obligatoires.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Un email valide est obligatoire.')
      return
    }
    if (!phone.trim()) {
      setError('Le numéro de téléphone est obligatoire.')
      return
    }
    if (!consentDataProcessing) {
      setError('Le consentement au traitement des données est obligatoire.')
      return
    }
    if (emailDup) {
      setError(`Une fiche existe déjà pour cet email (${emailDup.fullName}).`)
      return
    }

    setLoading(true)
    try {
      const input = {
        status: 'SEEKING',
        tpTypes: [TitleProfessionalType.CC],
        identity: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        },
        consentments: {
          dataProcessing: consentDataProcessing,
          dataSharing: consentDataSharing,
          aiProcessing: consentAiProcessing,
          photoProcessing: consentPhotoProcessing,
          consentDate: new Date().toISOString(),
          consentVersion: CONSENT_VERSION,
        },
      }
      const res = await candidateGraphqlClient.mutation(CREATE_CANDIDATE, { input })
      if (res.error) throw new Error(res.error.message.replace(/^\[GraphQL\]\s*/, ''))
      const newId: string | null = res.data?.createCandidate?.id ?? null
      if (!newId) throw new Error('Création échouée (id manquant)')
      if (onSaved) onSaved()
      if (onCreated) onCreated(newId)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-light flex items-center justify-center">
              <User size={18} className="text-purple" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nouveau candidat</h2>
              <p className="text-xs text-gray-400">Renseignez les informations minimales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form id="quick-create-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-bg text-danger rounded-lg text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <InputField
            id="qc-fullname"
            label="Nom et prénom *"
            placeholder="Ex: Jean Dupont"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <InputField
            id="qc-email"
            label="Email *"
            type="email"
            required
            placeholder="Ex: jean.dupont@email.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailDup && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={13} className="shrink-0" />
              Une fiche existe déjà pour cet email ({emailDup.fullName}).
            </p>
          )}
          <InputField
            id="qc-phone"
            label="Téléphone *"
            type="tel"
            required
            placeholder="Ex: 06 12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          {/* RGPD */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Consentements RGPD</h3>
            <p className="text-sm text-gray-500">
              En tant que centre de formation, nous traitons ces données pour accompagner le candidat dans sa recherche
              d&apos;alternance.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  required
                  className="accent-blue-600 h-4 w-4 mt-0.5"
                  checked={consentDataProcessing}
                  onChange={() => setConsentDataProcessing(!consentDataProcessing)}
                />
                Le candidat consent au traitement de ses données personnelles dans le cadre de son accompagnement
                (obligatoire).
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="accent-blue-600 h-4 w-4 mt-0.5"
                  checked={consentDataSharing}
                  onChange={() => setConsentDataSharing(!consentDataSharing)}
                />
                Le candidat accepte que ses données soient partagées avec des entreprises partenaires dans le cadre de la
                recherche d&apos;alternance.
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="accent-blue-600 h-4 w-4 mt-0.5"
                  checked={consentAiProcessing}
                  onChange={() => setConsentAiProcessing(!consentAiProcessing)}
                />
                Le candidat accepte le traitement de ses données par intelligence artificielle locale pour générer un résumé
                de profil.
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="accent-blue-600 h-4 w-4 mt-0.5"
                  checked={consentPhotoProcessing}
                  onChange={() => setConsentPhotoProcessing(!consentPhotoProcessing)}
                />
                Le candidat accepte le stockage de sa photo d&apos;identité.
              </label>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button
            form="quick-create-form"
            type="submit"
            isLoading={loading}
            disabled={!!emailDup}
            className="bg-purple hover:bg-purple-dark text-white"
            leftIcon={<Plus size={16} />}
          >
            Créer le candidat
          </Button>
        </div>
      </div>
    </div>
  )
}
