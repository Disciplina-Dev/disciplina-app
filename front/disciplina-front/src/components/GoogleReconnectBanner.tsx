import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useGoogleConnectionStatus } from '@/hooks/useGoogleConnectionStatus'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'

/**
 * Bandeau global affiché quand le compte Google du user n'est plus lié : jamais
 * connecté, ou jetons purgés côté back après une révocation détectée (invalid_grant).
 * Sans ça, Drive / Gmail / Calendar échouent silencieusement au milieu d'une action.
 */
export default function GoogleReconnectBanner() {
  const { connected } = useGoogleConnectionStatus()
  const { connectGoogle, isLoading } = useGoogleOAuthPopup()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (connected) return null

  const handleConnect = async () => {
    setErrorMsg(null)
    try {
      await connectGoogle()
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue')
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5">
      <AlertTriangle size={18} className="shrink-0 text-amber-600" />
      <span className="flex-1 text-[13px] font-medium text-amber-900">
        Votre compte Google n'est plus connecté. Les envois de mail, le Drive et le
        calendrier sont indisponibles tant que vous ne vous reconnectez pas.
        {errorMsg && <span className="ml-2 font-bold">{errorMsg}</span>}
      </span>
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="flex shrink-0 items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        {isLoading ? 'Connexion...' : 'Reconnecter Google'}
      </button>
    </div>
  )
}
