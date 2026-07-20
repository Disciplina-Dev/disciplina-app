import { Worker, Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

// Rendu PDF via pdf.js (canvas) plutôt qu'une iframe : le viewer natif de Chrome
// refuse de charger dans une iframe sandboxée (« This page has been blocked by
// Chrome »). Le rendu canvas n'expose jamais l'origine du front, donc le JWT en
// localStorage reste hors de portée du fichier affiché.
// La toolbar (zoom, scroll multi-pages, recherche, plein écran) vient du plugin.
export default function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const layout = defaultLayoutPlugin()
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-gray-100">
      <Worker workerUrl={workerUrl}>
        <Viewer fileUrl={fileUrl} plugins={[layout]} />
      </Worker>
    </div>
  )
}
