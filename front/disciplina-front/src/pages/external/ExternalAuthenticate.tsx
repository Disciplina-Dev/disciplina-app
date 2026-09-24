import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { openExternalLink } from '@/api/external'
import ExternalExpiryNotice from '@/features/external/components/ExternalExpiryNotice'

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type LinkState =
  | 'loading'
  | 'invalid'
  | 'blocked'
  | 'expired'
  | 'completed'

const STATE_MESSAGES: Record<LinkState, { title: string; text: string }> = {
  loading: { title: '', text: '' },
  invalid: { title: 'Lien inconnu', text: "Cette invitation n'existe pas." },
  blocked: {
    title: 'Lien indisponible',
    text: 'Ce lien a été bloqué. Contactez votre conseiller.',
  },
  expired: {
    title: 'Lien expiré',
    text: 'Ce lien était valable 7 jours après sa première ouverture. Contactez votre conseiller pour en recevoir un nouveau.',
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
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (!signature || sentRef.current) return
    sentRef.current = true
    openExternalLink(signature)
      .then((result) => {
        if (!result.ok) {
          if (result.reason === 'invalid') setLinkState('invalid')
          else if (result.reason === 'completed') setLinkState('completed')
          else if (result.reason === 'expired') setLinkState('expired')
          else setLinkState('blocked')
          return
        }
        setExpiresAt(result.expiresAt)
        if (result.referenceId === 2) {
          navigate(`/external/matching/${signature}`, { replace: true })
          return
        }
        if (result.referenceId === 3) {
          navigate(`/external/interview/${signature}`, { replace: true })
          return
        }
        navigate(`/external/cv-import/${signature}`, { replace: true })
      })
      .catch(() => setLinkState('blocked'))
  }, [signature, navigate])

  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Accès à votre espace</h1>

        {linkState === 'loading' && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-purple" />
            <p className="text-[13px] text-gray-500">Ouverture de votre lien sécurisé…</p>
          </div>
        )}

        {linkState !== 'loading' && (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={32} className="text-danger" />
            <p className="text-[15px] font-bold text-gray-800">{STATE_MESSAGES[linkState].title}</p>
            <p className="text-[13px] text-gray-500">{STATE_MESSAGES[linkState].text}</p>
          </div>
        )}

        <div className="mt-5 border-t border-gray-100 pt-3 text-center">
          {expiresAt ? (
            <p className="text-[12px] text-gray-500">
              Ce lien est valable 7 jours après sa première ouverture — il expire le{' '}
              {formatExpiryDate(expiresAt)}.
            </p>
          ) : (
            <ExternalExpiryNotice />
          )}
        </div>
      </div>
    </Centered>
  )
}
