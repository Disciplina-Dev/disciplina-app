import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

import { importKpiExcel, type KpiImportResult, type KpiSite } from '@/api/kpi'

interface Props {
  site: KpiSite
  onImported: (result: KpiImportResult) => void
  onError: (message: string) => void
}

/** Import du fichier Excel « Suivi commercial » (feuilles C.R Mois). */
export default function KpiImportButton({ site, onImported, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      onImported(await importKpiExcel(file, site))
    } catch (err) {
      onError(err instanceof Error ? err.message : "Échec de l'import Excel")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-700 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.04)] transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Import en cours…' : 'Importer Excel'}
      </button>
    </>
  )
}
