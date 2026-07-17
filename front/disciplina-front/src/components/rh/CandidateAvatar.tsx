import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface CandidateAvatarProps {
  candidateId: string
  fullName?: string
  /** Whether the candidate is known to have a photo (Drive or webcam). Skips the fetch when false. */
  hasPhoto: boolean
  /** Changing this forces a re-fetch (e.g. after a new webcam capture). */
  version?: string
  className?: string
  iconSize?: number
}

/**
 * Renders a candidate photo, fetching it (with auth) from the backend which serves
 * the Mongo cache or falls back to the file stored on Google Drive. Falls back to a
 * neutral user icon while loading, on error, or when the candidate has no photo.
 */
export default function CandidateAvatar({
  candidateId,
  fullName,
  hasPhoto,
  version,
  className = '',
  iconSize = 24,
}: CandidateAvatarProps) {
  const token = useAuthStore((s) => s.token)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hasPhoto || !token) {
      setUrl(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${candidateId}/avatar-file`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [candidateId, hasPhoto, token, version])

  if (url) {
    return <img src={url} alt={fullName ?? ''} className={`object-cover ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center bg-purple-light text-purple ${className}`}>
      <User size={iconSize} />
    </div>
  )
}
