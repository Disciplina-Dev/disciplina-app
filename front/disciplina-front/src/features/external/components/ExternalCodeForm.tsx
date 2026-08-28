import { useEffect, useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { inspectExternal, sendCodeExternal } from '@/api/external'

const RESEND_COOLDOWN_SECONDS = 30

interface Props {
  signature: string
  onLocked: () => void
  onAuthenticated: (referenceId: number) => void
  onAlreadyAuthenticated: () => void
}

export default function ExternalCodeForm({
  signature,
  onLocked,
  onAuthenticated,
  onAlreadyAuthenticated,
}: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const submit = async () => {
    setError(null)
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Code requis (6 chiffres).')
      return
    }
    setBusy(true)
    try {
      const result = await inspectExternal(signature, code.trim())
      if (result.ok) {
        onAuthenticated(result.referenceId)
        return
      }
      if (result.reason === 'locked') {
        onLocked()
        return
      }
      if (result.reason === 'already-authenticated') {
        onAlreadyAuthenticated()
        return
      }
      const suffix =
        result.reason === 'wrong-code' && result.remaining !== undefined
          ? ` ${result.remaining} tentative(s) restante(s).`
          : ''
      setError(result.reason === 'invalid' ? 'Lien inconnu.' : `Code incorrect.${suffix}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    try {
      const result = await sendCodeExternal(signature)
      if (result.ok) setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="Code à 6 chiffres"
        inputMode="numeric"
        maxLength={6}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-[16px] tracking-[0.4em] outline-none focus:border-purple"
      />

      {error && <p className="text-center text-[12px] text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-lg bg-purple px-4 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Vérifier
      </button>

      <button
        onClick={resend}
        disabled={resending || cooldown > 0}
        className="text-[12px] font-medium text-purple underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
      >
        {resending
          ? 'Envoi...'
          : cooldown > 0
            ? `Renvoyer le code (${cooldown}s)`
            : 'Renvoyer le code'}
      </button>
    </div>
  )
}