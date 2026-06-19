import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, MailCheck, RefreshCw } from 'lucide-react'
import { inspectMatch, regenerateMatch, type MatchInspectResult } from '@/api/match'
import MatchGateForm from '@/features/publicMatch/components/MatchGateForm'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>
}

export default function MatchGate() {
  const [params] = useSearchParams()
  const signature = params.get('sig') ?? ''
  const [inspect, setInspect] = useState<MatchInspectResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [regenerated, setRegenerated] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!signature) {
      setLoadError('Lien invalide.')
      return
    }
    inspectMatch(signature)
      .then(setInspect)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Erreur'))
  }, [signature])

  const requestNewLink = async () => {
    setRegenerating(true)
    try {
      await regenerateMatch(signature)
      setRegenerated(true)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setRegenerating(false)
    }
  }

  if (loadError) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-[15px] font-bold text-gray-800">Lien indisponible</p>
          <p className="text-[13px] text-gray-500">{loadError}</p>
        </div>
      </Centered>
    )
  }

  if (!inspect) {
    return (
      <Centered>
        <Loader2 size={28} className="animate-spin text-purple" />
      </Centered>
    )
  }

  if (!inspect.exists) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-[15px] font-bold text-gray-800">Lien inconnu</p>
          <p className="text-[13px] text-gray-500">Cette session de sélection n'existe pas.</p>
        </div>
      </Centered>
    )
  }

  const needsNewLink = inspect.expired || inspect.status === 'LOCKED' || locked

  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Sélection de candidats</h1>

        {needsNewLink ? (
          regenerated ? (
            <div className="mt-5 flex flex-col items-center gap-2 text-center">
              <MailCheck size={28} className="text-success" />
              <p className="text-[13px] text-gray-600">Un nouveau lien vient de vous être envoyé par email.</p>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-[13px] text-gray-500">
                {inspect.status === 'LOCKED' || locked
                  ? 'Accès bloqué après 3 tentatives.'
                  : 'Ce lien a expiré.'}{' '}
                Demandez un nouveau lien pour continuer.
              </p>
              <button
                onClick={requestNewLink}
                disabled={regenerating}
                className="flex items-center justify-center gap-2 rounded-lg bg-purple px-4 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-60"
              >
                {regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Demander un
                nouveau lien
              </button>
            </div>
          )
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-[13px] text-gray-500">
              Saisissez l'identifiant et le code reçus par email pour consulter les candidats.
            </p>
            <MatchGateForm signature={signature} onLocked={() => setLocked(true)} />
          </div>
        )}
      </div>
    </Centered>
  )
}
