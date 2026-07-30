import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, AlertCircle, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'
import { apiJson } from '@/api/httpClient'

function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.3l6-6C42.8 4.9 33.8 1 24 1 11.3 1 1 11.3 1 24s10.3 23 23 23c11.5 0 22-8.3 22-23 0-1.5-.2-2.7-.5-4z" fill="#FFC107" />
      <path d="M3.7 14.7l7 5.1C12.5 15.2 17.8 11 24 11c3.3 0 6.3 1.2 8.6 3.3l6-6C42.8 4.9 33.8 1 24 1 15.4 1 8 5.8 3.7 14.7z" fill="#FF3D00" />
      <path d="M24 47c9.6 0 18.4-3.7 24-12l-6.6-5.6C38.5 33.6 31.7 37 24 37c-6.1 0-11.2-4.1-13-9.7l-6.9 5.3C7.5 41.6 15 47 24 47z" fill="#4CAF50" />
      <path d="M44.5 20H24v8.5h11.8c-1 3-3 5.5-5.4 7.3l6.6 5.6C42.6 38.1 47 31.5 47 24c0-1.5-.2-2.7-.5-4z" fill="#1976D2" />
    </svg>
  )
}

export function GoogleDriveConnect({ theme = 'blue' }: { theme?: 'blue' | 'purple' }) {
  const user = useAuthStore((s) => s.user)
  const { connectGoogle, isLoading } = useGoogleOAuthPopup()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const isConnected = !!user?.googleConnected

  const handleConnect = async () => {
    setErrorMsg(null)
    try {
      await connectGoogle()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur inattendue est survenue')
    }
  }

  const handleDisconnect = async () => {
    setErrorMsg(null)
    setIsDisconnecting(true)
    try {
      await apiJson('/api/auth/google/disconnect', { method: 'POST' })
      useAuthStore.getState().updateUser({ googleConnected: false })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur inattendue est survenue')
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 px-3">
        <GoogleLogo size={22} />
        <span className="flex-1 text-[14px] font-bold text-gray-800">Google</span>
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
            {isDisconnecting ? 'Déconnexion...' : 'Déconnecter Google'}
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
            <GoogleLogo size={18} />
          )}
          <span className="text-[14px] font-bold">
            {isLoading ? 'Connexion...' : 'Se connecter à Google'}
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
