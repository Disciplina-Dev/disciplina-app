import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, AlertCircle, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'

const API_BASE = import.meta.env.VITE_API_URL

function DriveLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}

export function GoogleDriveConnect({ theme = 'blue' }: { theme?: 'blue' | 'purple' }) {
  const user = useAuthStore((s) => s.user)
  const { connectGoogle, isLoading } = useGoogleOAuthPopup()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const isConnected = !!user?.oauthToken

  const handleConnect = async () => {
    setErrorMsg(null)
    try {
      await connectGoogle()
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue')
    }
  }

  const handleDisconnect = async () => {
    setErrorMsg(null)
    setIsDisconnecting(true)
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE}/api/auth/google/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la déconnexion')
      }
      useAuthStore.getState().updateUser({ oauthToken: undefined })
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue')
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 px-3">
        <DriveLogo size={22} />
        <span className="flex-1 text-[14px] font-bold text-gray-800">Drive</span>
        {isConnected ? (
          <CheckCircle2 size={18} className="text-success" />
        ) : (
          <XCircle size={18} className="text-danger" />
        )}
      </div>

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger-bg py-2.5 px-4 text-danger hover:bg-danger/10 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isDisconnecting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <LogOut size={18} />
          )}
          <span className="text-[14px] font-bold">
            {isDisconnecting ? 'Déconnexion...' : 'Déconnecter Drive'}
          </span>
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-white hover:shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed ${
            theme === 'purple' ? 'bg-purple hover:bg-purple-dark' : 'bg-blue hover:bg-blue-dark'
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <DriveLogo size={18} />
          )}
          <span className="text-[14px] font-bold">
            {isLoading ? 'Connexion...' : 'Connecter Drive'}
          </span>
        </button>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 text-danger text-[12px] mt-1 bg-danger-bg p-2 rounded-md">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
