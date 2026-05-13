import { useEffect } from 'react'

export default function GoogleAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (window.opener) {
      try {
        window.opener.postMessage({ code, state, error }, window.location.origin)
      } catch {
        // opener might be closed or on different origin
      }
      window.close()
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Fermeture de la fenêtre...</p>
    </div>
  )
}
