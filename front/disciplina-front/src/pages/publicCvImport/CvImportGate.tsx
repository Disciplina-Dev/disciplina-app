import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { inspectCvImport, type CvImportInspectResult } from '@/api/cvImport'
import CvImportGateForm from '@/features/publicCvImport/components/CvImportGateForm'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>
}

export default function CvImportGate() {
  const [params] = useSearchParams()
  const signature = params.get('sig') ?? ''
  const [inspect, setInspect] = useState<CvImportInspectResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!signature) return
    inspectCvImport(signature)
      .then(setInspect)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Erreur'))
  }, [signature])

  if (!signature) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-[15px] font-bold text-gray-800">Lien indisponible</p>
          <p className="text-[13px] text-gray-500">Lien invalide.</p>
        </div>
      </Centered>
    )
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
          <p className="text-[13px] text-gray-500">Cette invitation n'existe pas.</p>
        </div>
      </Centered>
    )
  }

  const blocked = inspect.expired || inspect.status === 'LOCKED' || locked

  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Import de votre CV</h1>

        {blocked ? (
          <div className="mt-5 flex flex-col gap-2 text-center">
            <p className="text-[13px] text-gray-500">
              {inspect.status === 'LOCKED' || locked
                ? 'Accès bloqué après 3 tentatives.'
                : 'Ce lien a expiré.'}{' '}
              Contactez votre conseiller pour recevoir un nouveau lien.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-[13px] text-gray-500">
              Saisissez le code reçu par email pour importer votre CV.
            </p>
            <CvImportGateForm signature={signature} onLocked={() => setLocked(true)} />
          </div>
        )}
      </div>
    </Centered>
  )
}
