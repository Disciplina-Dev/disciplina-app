import { useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
  Loader2,
  Maximize,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

// Rendu PDF via pdf.js (canvas) plutôt qu'une iframe : le viewer natif de Chrome
// refuse de charger dans une iframe sandboxée (« This page has been blocked by
// Chrome »). Le rendu canvas n'expose jamais l'origine du front, donc le JWT en
// localStorage reste hors de portée du fichier affiché.
// react-pdf v11 embarque pdfjs-dist 6 (RCE GHSA-wgrm-67xf-hhpq corrigée) et
// isEvalSupported: false interdit tout JS embarqué dans le PDF.
const OPTIONS = {
  cMapUrl: `${import.meta.env.BASE_URL}cmaps/`,
  standardFontDataUrl: `${import.meta.env.BASE_URL}standard_fonts/`,
  isEvalSupported: false,
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export default function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  function onLoadSuccess(pdf: PDFDocumentProxy) {
    setNumPages(pdf.numPages)
    setPage(1)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current?.requestFullscreen()
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-100 bg-white"
    >
      <div className="flex items-center gap-0.5 border-b border-gray-100 px-2 py-1">
        <ToolbarButton
          label="Page précédente"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft size={18} />
        </ToolbarButton>
        <span className="min-w-16 text-center text-xs text-gray-600">
          {numPages === 0 ? '…' : `${page} / ${numPages}`}
        </span>
        <ToolbarButton
          label="Page suivante"
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          disabled={page >= numPages}
        >
          <ChevronRight size={18} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarButton
          label="Zoom arrière"
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          disabled={scale <= 0.5}
        >
          <ZoomOut size={18} />
        </ToolbarButton>
        <span className="min-w-12 text-center text-xs text-gray-600">
          {Math.round(scale * 100)} %
        </span>
        <ToolbarButton
          label="Zoom avant"
          onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
          disabled={scale >= 3}
        >
          <ZoomIn size={18} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarButton label="Plein écran" onClick={toggleFullscreen}>
          <Maximize size={18} />
        </ToolbarButton>
        <a
          href={fileUrl}
          download
          aria-label="Télécharger le PDF"
          title="Télécharger le PDF"
          className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
        >
          <Download size={18} />
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
        <Document
          file={fileUrl}
          onLoadSuccess={onLoadSuccess}
          options={OPTIONS}
          loading={
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin" /> Chargement du PDF…
            </div>
          }
          error={
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-red-600">
              <FileWarning size={18} /> Impossible d'afficher ce PDF.
            </div>
          }
        >
          <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer />
        </Document>
      </div>
    </div>
  )
}
