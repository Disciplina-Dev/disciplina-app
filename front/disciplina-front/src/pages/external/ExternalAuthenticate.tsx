import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconAlert, IconLoader } from '@/components/ui/icons'
import { openExternalLink } from '@/api/external'
import ExternalExpiryNotice from '@/features/external/components/ExternalExpiryNotice'

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
    text: 'Ce lien a été bloqué ou clôturé. Contactez votre conseiller.',
  },
  expired: {
    title: 'Lien expiré',
    text: 'Ce lien historique à durée limitée a expiré, ou il a été clôturé. Contactez votre conseiller pour en recevoir un nouveau.',
  },
  completed: { title: 'Démarche déjà finalisée', text: 'Ce lien a été clôturé, vous avez déjà réalisé cette démarche.' },
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">{children}</div>
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
      <div className="w-full max-w-sm rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-[var(--ds-text)]">Accès à votre espace</h1>

        {linkState === 'loading' && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <IconLoader width={28} height={28} className="animate-spin text-purple" />
            <p className="text-[13px] text-[var(--ds-text-subtle)]">Ouverture de votre lien sécurisé…</p>
          </div>
        )}

        {linkState !== 'loading' && (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
            <p className="text-[15px] font-bold text-[var(--ds-text)]">{STATE_MESSAGES[linkState].title}</p>
            <p className="text-[13px] text-[var(--ds-text-subtle)]">{STATE_MESSAGES[linkState].text}</p>
          </div>
        )}

        <div className="mt-5 border-t border-[var(--ds-border)] pt-3 text-center">
          <ExternalExpiryNotice expiresAt={expiresAt} />
        </div>
      </div>
    </Centered>
  )
}
