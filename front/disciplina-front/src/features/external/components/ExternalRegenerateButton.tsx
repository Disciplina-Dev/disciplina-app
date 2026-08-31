import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { regenerateExternalAccess } from '@/api/externalAccess'

interface ExternalRegenerateButtonProps {
  signature: string
  allowed: boolean
  onRegenerated: () => void
}

// Régénère le lien d'un accès externe expiré ou bloqué. Toujours visible ;
// désactivé pour les statuts que le backend refuse de régénérer.
export default function ExternalRegenerateButton({ signature, allowed, onRegenerated }: ExternalRegenerateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await regenerateExternalAccess(signature)
      onRegenerated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la régénération du lien")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!allowed || loading}
        title={allowed ? "Régénérer le lien" : "Seuls les liens expirés ou bloqués peuvent être régénérés"}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        Régénérer
      </button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  )
}
