import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Mail, PenLine, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'

// Aperçu avant l'envoi en signature : le commercial vérifie les documents
// (Analyse du Besoin + Mandat à signer + Catalogue à consulter) ainsi que le
// mail qui partira, puis confirme. La confirmation déclenche l'envoi DocuSeal
// réel (send_email côté API). Annuler laisse l'AB en BROUILLON.

interface Props {
  abId: number
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

type TabKey = 'ab' | 'mandat' | 'catalogue'

const TABS: { key: TabKey; label: string; path: (id: number) => string }[] = [
  { key: 'ab', label: 'Analyse du Besoin', path: (id) => `/api/needs-analysis/${id}/pdf` },
  { key: 'mandat', label: 'Mandat', path: () => `/api/needs-analysis/signature/mandat-pdf` },
  { key: 'catalogue', label: 'Catalogue', path: () => `/api/needs-analysis/signature/catalogue-pdf` },
]

export default function SignaturePreviewModal({ abId, onConfirm, onCancel }: Props) {
  const token = useAuthStore((s) => s.token)
  const [activeTab, setActiveTab] = useState<TabKey>('ab')
  const [pdfUrls, setPdfUrls] = useState<Record<TabKey, string | null>>({ ab: null, mandat: null, catalogue: null })
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Charge les 3 PDF (en blob, pour pouvoir les afficher inline malgré l'auth) + le mail.
  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    async function fetchPdf(path: string): Promise<string> {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers })
      if (!res.ok) throw new Error(`Chargement du document échoué (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      created.push(url)
      return url
    }

    ;(async () => {
      try {
        const [ab, mandat, catalogue] = await Promise.all([
          fetchPdf(`/api/needs-analysis/${abId}/pdf`),
          fetchPdf(`/api/needs-analysis/signature/mandat-pdf`),
          fetchPdf(`/api/needs-analysis/signature/catalogue-pdf`),
        ])
        const mailRes = await fetch(`${import.meta.env.VITE_API_URL}/api/needs-analysis/signature/email`, { headers })
        const mail = mailRes.ok ? await mailRes.json() : { subject: '', body: '' }
        if (cancelled) return
        setPdfUrls({ ab, mandat, catalogue })
        setEmail(mail)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erreur de chargement')
      }
    })()

    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [abId, token])

  const handleConfirm = async () => {
    setSending(true)
    try {
      await onConfirm()
    } finally {
      setSending(false)
    }
  }

  const activeUrl = pdfUrls[activeTab]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Aperçu avant envoi en signature</h2>
          <button onClick={onCancel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 px-6 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-blue-50 text-blue' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <FileText size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body : PDF + mail */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
          {loadError ? (
            <p className="rounded-lg border border-danger-bg bg-danger-bg px-4 py-2.5 text-sm text-danger">{loadError}</p>
          ) : (
            <div className="min-h-[45vh] flex-1 overflow-hidden rounded-lg border border-gray-200">
              {activeUrl ? (
                <iframe title={activeTab} src={activeUrl} className="h-full min-h-[45vh] w-full" />
              ) : (
                <div className="flex h-full min-h-[45vh] items-center justify-center text-sm text-gray-400">
                  Chargement du document…
                </div>
              )}
            </div>
          )}

          {/* Aperçu du mail (lecture seule) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Mail size={15} /> Mail envoyé au responsable recrutement
            </div>
            <p className="text-sm text-gray-800">
              <span className="font-medium">Objet :</span> {email?.subject ?? '…'}
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-gray-600">{email?.body ?? ''}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" onClick={onCancel} disabled={sending}>
            Annuler (garder en brouillon)
          </Button>
          <Button isLoading={sending} leftIcon={<PenLine size={16} />} onClick={handleConfirm}>
            Confirmer l'envoi en signature
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
