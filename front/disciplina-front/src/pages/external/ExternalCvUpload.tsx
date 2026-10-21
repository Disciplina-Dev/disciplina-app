import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconAlert, IconCheckCircle, IconLoader, IconUpload } from '@/components/ui/icons'
import { getExternalProfile, uploadExternalCv, completeExternalCv, ExternalAuthError, type ExternalProfile } from '@/api/external'
import ExternalExpiryNotice from '@/features/external/components/ExternalExpiryNotice'
import ExternalGuestCloseButton from '@/features/external/components/ExternalGuestCloseButton'

export default function ExternalCvUpload() {
  const { signature } = useParams<{ signature: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ExternalProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [closed, setClosed] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!signature) {
      navigate('/external/authenticate', { replace: true })
      return
    }
    getExternalProfile(signature)
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ExternalAuthError) {
          navigate(`/external/authenticate?sig=${signature}`, { replace: true })
          return
        }
        setLoadError(e instanceof Error ? e.message : 'Erreur')
      })
  }, [signature, navigate])

  const handleFile = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      await uploadExternalCv(signature!, file)
      completeExternalCv(signature!).catch(() => {})
      setUploaded(true)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erreur lors de l'upload")
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
          <p className="text-[15px] font-bold text-[var(--ds-text)]">Erreur</p>
          <p className="text-[13px] text-[var(--ds-text-subtle)]">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">
        <IconLoader width={28} height={28} className="animate-spin text-purple" />
      </div>
    )
  }

  if (closed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 text-center shadow-sm">
          <IconCheckCircle width={48} height={48} className="mx-auto text-[var(--ds-success)]" />
          <h2 className="mt-4 text-[18px] font-extrabold text-[var(--ds-text)]">Lien clôturé</h2>
          <p className="mt-2 text-[13px] text-[var(--ds-text-subtle)]">
            Ce lien a été clôturé. Votre conseiller en a été notifié.
          </p>
        </div>
      </div>
    )
  }

  if (uploaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 text-center shadow-sm">
          <IconCheckCircle width={48} height={48} className="mx-auto text-[var(--ds-success)]" />
          <h2 className="mt-4 text-[18px] font-extrabold text-[var(--ds-text)]">CV importé avec succès</h2>
          <p className="mt-2 text-[13px] text-[var(--ds-text-subtle)]">
            Votre CV a bien été transmis à votre conseiller.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
            <h1 className="mt-1 text-[20px] font-extrabold text-[var(--ds-text)]">Import de votre CV</h1>
          </div>
          <div className="shrink-0">
            <ExternalGuestCloseButton signature={signature!} onClosed={() => setClosed(true)} />
          </div>
        </div>
        <p className="mt-1 text-[13px] text-[var(--ds-text-subtle)]">{profile.externalEmail}</p>
        <ExternalExpiryNotice expiresAt={profile.expiresAt} />

        <div className="mt-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-purple bg-purple/5' : 'border-[var(--ds-border)] hover:border-[var(--ds-border-strong)]'
            }`}
          >
            <IconUpload width={32} height={32} className={dragOver ? 'text-purple' : 'text-[var(--ds-text-subtle)]'} />
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[var(--ds-text-muted)]">
                Cliquez ou déposez votre CV ici
              </p>
              <p className="mt-1 text-[11px] text-[var(--ds-text-subtle)]">PDF, JPG ou PNG</p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {uploading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-purple">
            <IconLoader width={16} height={16} className="animate-spin" />
            Import en cours...
          </div>
        )}

        {uploadError && <p className="mt-3 text-center text-[12px] text-[var(--ds-danger)]">{uploadError}</p>}
      </div>
    </div>
  )
}