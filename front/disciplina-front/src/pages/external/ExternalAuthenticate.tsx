import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import ExternalCodeForm from '@/features/external/components/ExternalCodeForm'
import { sendCodeExternal } from '@/api/external'

type LinkState =
  | 'loading'
  | 'ready'
  | 'invalid'
  | 'blocked'
  | 'completed'

const STATE_MESSAGES: Record<Exclude<LinkState, 'loading' | 'ready'>, { title: string; text: string }> = {
  invalid: { title: 'Lien inconnu', text: "Cette invitation n'existe pas." },
  blocked: {
    title: 'Lien indisponible',
    text: 'Ce lien a expiré ou a été bloqué. Contactez votre conseiller.',
  },
  completed: { title: 'Démarche déjà finalisée', text: 'Vous avez déjà réalisé cette démarche.' },
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>
}

export default function ExternalAuthenticate() {
  const [params] = useSearchParams()
  const signature = params.get('sig') ?? ''
  const navigate = useNavigate()
  const [linkState, setLinkState] = useState<LinkState>(signature ? 'loading' : 'invalid')
  const sentRef = useRef(false)

  useEffect(() => {
    if (!signature || sentRef.current) return
    sentRef.current = true
    sendCodeExternal(signature)
      .then((result) => {
        if (!result.ok) {
          setLinkState(result.reason === 'invalid' ? 'invalid' : result.reason === 'completed' ? 'completed' : 'blocked')
          return
        }
        setLinkState('ready')
      })
      .catch(() => setLinkState('ready'))
  }, [signature])

  const redirectToFlow = (referenceId: number) => {
    if (referenceId === 2) {
      navigate(`/external/matching/${signature}`, { replace: true })
      return
    }
    if (referenceId === 3) {
      navigate(`/external/interview/${signature}`, { replace: true })
      return
    }
    navigate(`/external/cv-import/${signature}`, { replace: true })
  }

  const handleAuthenticated = (referenceId: number) => redirectToFlow(referenceId)

  const handleAlreadyAuthenticated = (referenceId?: number) => redirectToFlow(referenceId ?? 1)

  const handleLocked = () => setLinkState('blocked')

  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Vérification d'identité</h1>

        {linkState === 'loading' && (
          <div className="mt-8 flex justify-center">
            <Loader2 size={28} className="animate-spin text-purple" />
          </div>
        )}

        {(linkState === 'invalid' || linkState === 'blocked' || linkState === 'completed') && (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={32} className="text-danger" />
            <p className="text-[15px] font-bold text-gray-800">{STATE_MESSAGES[linkState].title}</p>
            <p className="text-[13px] text-gray-500">{STATE_MESSAGES[linkState].text}</p>
          </div>
        )}

        {linkState === 'ready' && (
          <div className="mt-5">
            <p className="mb-3 text-[13px] text-gray-500">
              Un code à 6 chiffres vous a été envoyé par email. Saisissez-le pour continuer.
            </p>
            <ExternalCodeForm
              signature={signature}
              onLocked={handleLocked}
              onAuthenticated={handleAuthenticated}
              onAlreadyAuthenticated={handleAlreadyAuthenticated}
            />
          </div>
        )}
      </div>
    </Centered>
  )
}