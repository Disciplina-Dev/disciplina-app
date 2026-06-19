import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { authenticateMatch } from '@/api/match'
import { useGuestMatchTokenStore } from '@/store/guestMatchTokenStore'

const REASON_MESSAGES: Record<'invalid' | 'locked' | 'expired', string> = {
  invalid: 'Code ou identifiant incorrect.',
  locked: 'Accès bloqué après 3 tentatives. Demandez une nouvelle session à votre conseiller.',
  expired: 'Ce lien a expiré.',
}

export default function MatchGateForm({ signature, onLocked }: { signature: string; onLocked: () => void }) {
  const navigate = useNavigate()
  const setToken = useGuestMatchTokenStore((s) => s.setToken)
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!identifier.trim() || !code.trim()) {
      setError('Identifiant et code requis.')
      return
    }
    setBusy(true)
    try {
      const result = await authenticateMatch(signature, code.trim(), identifier.trim())
      if (result.ok) {
        setToken(result.token)
        navigate(`/public/match/${signature}`)
        return
      }
      if (result.reason === 'locked') onLocked()
      const suffix =
        result.reason === 'invalid' && result.remaining !== undefined
          ? ` ${result.remaining} tentative(s) restante(s).`
          : ''
      setError(REASON_MESSAGES[result.reason] + suffix)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Identifiant"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code à 6 chiffres"
        inputMode="numeric"
        maxLength={6}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] tracking-widest outline-none focus:border-purple"
      />
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-lg bg-purple px-4 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Accéder aux candidats
      </button>
    </div>
  )
}
