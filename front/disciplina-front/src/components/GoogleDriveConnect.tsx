import { useState } from 'react'
import { Cloud, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { userGraphqlClient } from '@/graphql/client'
import { useAuthStore } from '@/store/authStore'

const LINK_GOOGLE_DRIVE_MUTATION = `
  mutation LinkGoogleDrive($code: String!) {
    linkGoogleDrive(code: $code) {
      id
      email
      name
      role
      oauthToken
    }
  }
`

export function GoogleDriveConnect({ theme = 'blue' }: { theme?: 'blue' | 'purple' }) {
  const { user, updateUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isConnected = !!user?.oauthToken

  const login = useGoogleLogin({
    use_fedcm_for_prompt: true,
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify',
    onSuccess: async (codeResponse) => {
      setIsLoading(true)
      setErrorMsg(null)
      try {
        const result = await userGraphqlClient.mutation(LINK_GOOGLE_DRIVE_MUTATION, { code: codeResponse.code }).toPromise()
        if (result.error) {
          setErrorMsg(result.error.message || "Erreur lors de l'association")
        } else if (result.data?.linkGoogleDrive) {
          updateUser(result.data.linkGoogleDrive)
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Une erreur inattendue est survenue")
      } finally {
        setIsLoading(false)
      }
    },
    onError: (errorResponse) => {
      setErrorMsg("La connexion à Google a échoué")
      console.error(errorResponse)
    },
  })

  if (isConnected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg py-2.5 px-4 border border-success/20 transition-all duration-200">
          <CheckCircle2 size={18} className="text-success" />
          <span className="text-[14px] font-bold text-success">Drive connecté</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => login()}
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
          {isLoading ? 'Connexion...' : 'Associer mon Google Drive'}
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
