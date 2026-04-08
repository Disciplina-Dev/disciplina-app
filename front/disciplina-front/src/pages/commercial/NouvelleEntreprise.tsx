import { useState } from 'react'
import {
  ArrowLeft, Search, CheckCircle, AlertTriangle, XCircle,
  ArrowRight, Building2, RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'siret' | 'verify' | 'details'

type VerifResult = {
  statut: 'actif' | 'inactif' | 'inconnu'
  nom: string
  siret: string
  siren: string
  adresse: string
  secteur: string
  naf: string
  dirigeant: string
  digiformaStatut: 'disponible' | 'déjà_suivi'
}

// ─── Mock API response ────────────────────────────────────────────────────────
const MOCK_VERIF: VerifResult = {
  statut: 'actif',
  nom: 'GARAGE RIVIÈRE SARL',
  siret: '83284921000018',
  siren: '832849210',
  adresse: '12 Rue des Flamboyants, 97400 Saint-Denis',
  secteur: "Commerce et réparation d'automobiles",
  naf: '4511Z',
  dirigeant: 'Jean-Pierre Rivière',
  digiformaStatut: 'disponible',
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = [
  { id: 'siret'  as Step, label: 'SIRET' },
  { id: 'verify' as Step, label: 'Vérification' },
  { id: 'details'as Step, label: 'Détails' },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-2">
      {STEPS.map(({ id, label }, i) => {
        const done = i < currentIdx
        const active = id === current
        return (
          <div key={id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-sm ${active ? 'text-blue' : done ? 'text-success' : 'text-gray-300'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                active ? 'bg-blue text-white' : done ? 'bg-success text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`font-medium ${active ? 'text-blue' : done ? 'text-success' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < currentIdx ? 'bg-success' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NouvelleEntreprise() {
  const [step, setStep]       = useState<Step>('siret')
  const [siret, setSiret]     = useState('')
  const [loading, setLoading] = useState(false)
  const [verif, setVerif]     = useState<VerifResult | null>(null)

  const handleSearch = () => {
    setLoading(true)
    setTimeout(() => {
      setVerif(MOCK_VERIF)
      setStep('verify')
      setLoading(false)
    }, 1000)
  }

  const formatSiret = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 14)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4').trim()
  }

  return (
    <div className="p-8 max-w-xl space-y-7">
      {/* Header */}
      <div>
        <Link
          to="/commercial/portefeuille"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={13} /> Portefeuille
        </Link>
        <h1 className="text-2xl font-black text-black">Nouvelle entreprise</h1>
        <p className="text-gray-500 text-sm mt-0.5">Vérification SIRET, puis ajout au CRM</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: SIRET ── */}
      {step === 'siret' && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-900">Entrez le numéro SIRET</h3>
            <p className="text-sm text-gray-400 mt-1">
              Permet de vérifier l'activité de l'entreprise et de pré-remplir les informations.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2.5">
              <input
                value={formatSiret(siret)}
                onChange={e => setSiret(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456 789 01234"
                maxLength={17}
                className="flex-1 px-4 h-11 border border-gray-200 rounded-xl text-sm font-mono tracking-widest text-gray-900 placeholder:text-gray-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
              <Button
                onClick={handleSearch}
                isLoading={loading}
                disabled={siret.length !== 14}
                leftIcon={loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              >
                Vérifier
              </Button>
            </div>
            <p className="text-xs text-gray-300">14 chiffres — sans espaces</p>
          </div>

          <div className="border-t border-gray-50 pt-4">
            <p className="text-xs text-gray-400 mb-2">Où trouver le SIRET ?</p>
            <div className="flex flex-wrap gap-2">
              {['Pages Jaunes', 'LinkedIn', 'Indeed', 'Facebook', 'France Travail', 'Listing Lorenzo'].map(s => (
                <span key={s} className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-100 text-gray-500 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Verify ── */}
      {step === 'verify' && verif && (
        <div className="space-y-4">
          {/* SIRET status */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            verif.statut === 'actif'
              ? 'bg-success-bg border-success/20'
              : 'bg-danger-bg border-danger/20'
          }`}>
            {verif.statut === 'actif'
              ? <CheckCircle size={18} className="text-success shrink-0 mt-0.5" />
              : <XCircle    size={18} className="text-danger shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-semibold ${verif.statut === 'actif' ? 'text-success' : 'text-danger'}`}>
                {verif.statut === 'actif' ? 'Entreprise active' : 'Entreprise inactive ou introuvable'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                SIRET {verif.siret} · NAF {verif.naf}
              </p>
            </div>
          </div>

          {/* Digiforma */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            verif.digiformaStatut === 'disponible'
              ? 'bg-success-bg border-success/20'
              : 'bg-warning-bg border-warning/20'
          }`}>
            {verif.digiformaStatut === 'disponible'
              ? <CheckCircle   size={18} className="text-success shrink-0 mt-0.5" />
              : <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-semibold ${verif.digiformaStatut === 'disponible' ? 'text-success' : 'text-warning'}`}>
                {verif.digiformaStatut === 'disponible'
                  ? 'Disponible — aucun suivi Digiforma'
                  : 'Attention — déjà suivie sur Digiforma'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {verif.digiformaStatut === 'disponible'
                  ? "Cette entreprise n'est pas encore dans le CRM."
                  : 'Un autre commercial suit déjà cette entreprise.'}
              </p>
            </div>
          </div>

          {/* Company preview */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-light rounded-xl flex items-center justify-center">
                <Building2 size={17} className="text-blue" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{verif.nom}</p>
                <p className="text-xs text-gray-400">{verif.secteur}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 border-t border-gray-50 pt-3">
              <p>📍 {verif.adresse}</p>
              <p>👤 {verif.dirigeant}</p>
              <p>🏷️ SIREN {verif.siren}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('siret')}>
              Modifier le SIRET
            </Button>
            <Button onClick={() => setStep('details')} rightIcon={<ArrowRight size={14} />} disabled={verif.statut !== 'actif'}>
              Continuer
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Details ── */}
      {step === 'details' && verif && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">Compléter les informations</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Raison sociale</label>
              <input
                defaultValue={verif.nom}
                className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Secteur</label>
              <input
                defaultValue="Automobile"
                className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Centre rattaché</label>
              <select className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue bg-white">
                <option>Nord — Sainte-Marie</option>
                <option>Ouest — Saint-Paul</option>
                <option>Sud — Saint-Pierre</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Téléphone</label>
              <input
                placeholder="+262 692 XX XX XX"
                className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                placeholder="contact@entreprise.re"
                className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Source de prospection</label>
              <select className="w-full px-3.5 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue bg-white">
                <option>Pages Jaunes</option>
                <option>LinkedIn</option>
                <option>Indeed</option>
                <option>Facebook</option>
                <option>Listing Lorenzo</option>
                <option>France Travail</option>
                <option>Recommandation</option>
                <option>Autre</option>
              </select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes initiales</label>
              <textarea
                rows={3}
                placeholder="Informations recueillies lors de la prospection, contexte particulier…"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={() => setStep('verify')}>
              Retour
            </Button>
            <Button leftIcon={<CheckCircle size={14} />}>
              Ajouter au portefeuille
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
