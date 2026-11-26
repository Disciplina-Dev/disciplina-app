import { useState } from 'react'
import { IconLoader, IconWarning } from '@/components/ui/icons'
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
    // Bandeau volontairement discret : il informe en continu sans dominer
    // l'ecran. Le bouton porte l'accent, pas la bande entiere.
    <div className="ds-glass-flush flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--ds-glass-border)] px-6 py-2.5">
      <IconWarning width={18} height={18} className="shrink-0 text-[var(--ds-warning)]" />
      <span className="flex-1 text-[13px] font-medium text-[var(--ds-text-muted)]">
        Votre compte Google n'est plus connecté. Les envois de mail, le Drive et le
        calendrier sont indisponibles tant que vous ne vous reconnectez pas.
        {errorMsg && <span className="ml-2 font-bold">{errorMsg}</span>}
      </span>
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--ds-warning)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <IconLoader width={14} height={14} className="animate-spin" />}
        {isLoading ? 'Connexion...' : 'Reconnecter Google'}
      </button>
    </div>
  )
}
