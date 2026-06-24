import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { authenticateInterview } from '@/api/interview'
import { useGuestInterviewTokenStore } from '@/store/guestInterviewTokenStore'

const REASON_MESSAGES: Record<'invalid' | 'locked' | 'expired', string> = {
  invalid: 'Code incorrect.',
  locked: 'Accès bloqué après 3 tentatives.',
  expired: 'Ce lien a expiré.',
}

export default function InterviewGateForm({ signature, onLocked }: { signature: string; onLocked: () => void }) {
  const navigate = useNavigate()
  const setToken = useGuestInterviewTokenStore((s) => s.setToken)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!code.trim()) {
      setError('Code requis.')
      return
    }
    setBusy(true)
    try {
      const result = await authenticateInterview(signature, code.trim())
      if (result.ok) {
        setToken(result.token)
        navigate(`/public/interview/${signature}`)
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
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Choisir mon créneau
      </button>
    </div>
  )
}
