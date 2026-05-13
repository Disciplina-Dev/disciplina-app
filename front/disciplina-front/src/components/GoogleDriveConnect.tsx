import { useState } from 'react'
import { Cloud, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'

export function GoogleDriveConnect({ theme = 'blue' }: { theme?: 'blue' | 'purple' }) {
  const user = useAuthStore((s) => s.user)
  const { connectGoogle, isLoading } = useGoogleOAuthPopup()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isConnected = !!user?.oauthToken

  const handleConnect = async () => {
    setErrorMsg(null)
    try {
      await connectGoogle()
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue')
    }
  }

  if (isConnected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg py-2.5 px-4 border border-success/20 transition-all duration-200">
          <CheckCircle2 size={18} className="text-success" />
          <span className="text-[14px] font-bold text-success">Google connecté</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
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
          <Cloud size={18} />
        )}
        <span className="text-[14px] font-bold">
          {isLoading ? 'Connexion...' : 'Associer mon compte Google'}
        </span>
      </button>

      {errorMsg && (
        <div className="flex items-start gap-2 text-danger text-[12px] mt-1 bg-danger-bg p-2 rounded-md">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
