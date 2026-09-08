import { useEffect, useState } from 'react'
import { Loader2, FileWarning, Download } from 'lucide-react'
import { getMatchCv, type ProposedCandidateView } from '@/api/match'

function base64ToBlobUrl(content: string, contentType: string): string {
  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: contentType || 'application/pdf' }))
}

function CvViewer({ signature, candidateId }: { signature: string; candidateId: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('cv.pdf')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let url: string | null = null
    getMatchCv(signature, candidateId)
      .then((cv) => {
        url = base64ToBlobUrl(cv.content, cv.contentType)
        setFilename(cv.filename)
        setBlobUrl(url)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [signature, candidateId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple" />
      </div>
    )
  }
  if (error || !blobUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[13px] text-gray-400">
        <FileWarning size={28} className="text-danger" />
        CV indisponible.
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col">
      <object data={blobUrl} type="application/pdf" className="h-full w-full rounded-lg border border-gray-200">
        <div className="flex h-full items-center justify-center">
          <a
            href={blobUrl}
            download={filename}
            className="inline-flex items-center gap-2 rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white"
          >
            <Download size={15} /> Télécharger le CV
          </a>
        </div>
      </object>
    </div>
  )
}

export default function CandidateComparator({
  signature,
  candidate,
}: {
  signature: string
  candidate: ProposedCandidateView
}) {
  return (
    <div className="grid h-[70vh] gap-4 md:grid-cols-2">
      <div className="h-full overflow-hidden rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
        <CvViewer key={candidate.id} signature={signature} candidateId={candidate.id} />
      </div>
      <div className="h-full overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-[18px] font-extrabold text-gray-900">{candidate.fullName ?? 'Candidat'}</h2>
        <div className="mt-1 flex flex-wrap gap-3 text-[13px] text-gray-500">
          {candidate.age != null && <span>{candidate.age} ans</span>}
          {candidate.city && <span>{candidate.city}</span>}
        </div>
        <p className="mt-4 text-[12px] font-bold uppercase tracking-wider text-purple">Note du conseiller</p>
        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700">
          {candidate.description || 'Aucune note.'}
        </p>
      </div>
    </div>
  )
}
