import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { getExternalProfile, uploadExternalCv, completeExternalCv, ExternalAuthError, type ExternalProfile } from '@/api/external'

export default function ExternalCvUpload() {
  const { signature } = useParams<{ signature: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ExternalProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-[15px] font-bold text-gray-800">Erreur</p>
          <p className="text-[13px] text-gray-500">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <Loader2 size={28} className="animate-spin text-purple" />
      </div>
    )
  }

  if (uploaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <CheckCircle size={48} className="mx-auto text-green-500" />
          <h2 className="mt-4 text-[18px] font-extrabold text-gray-900">CV importé avec succès</h2>
          <p className="mt-2 text-[13px] text-gray-500">
            Votre CV a bien été transmis à votre conseiller.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Import de votre CV</h1>
        <p className="mt-1 text-[13px] text-gray-500">{profile.externalEmail}</p>

        <div className="mt-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-purple bg-purple/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Upload size={32} className={dragOver ? 'text-purple' : 'text-gray-300'} />
            <div className="text-center">
              <p className="text-[13px] font-semibold text-gray-700">
                Cliquez ou déposez votre CV ici
              </p>
              <p className="mt-1 text-[11px] text-gray-400">PDF, JPG ou PNG</p>
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
            <Loader2 size={16} className="animate-spin" />
            Import en cours...
          </div>
        )}

        {uploadError && <p className="mt-3 text-center text-[12px] text-danger">{uploadError}</p>}
      </div>
    </div>
  )
}