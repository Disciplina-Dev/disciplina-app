import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'

import { saveKpi, KPI_SITES, type KpiMetrics, type KpiSelectableUser, type KpiSite } from '@/api/kpi'
import { useAuthStore } from '@/store/authStore'
import { KPI_METRICS, MONTH_FULL_LABELS, SITE_LABELS, emptyMetrics } from '../config'

export interface KpiEntryDraft {
  userId: number
  userName: string
  month: number
  /** 0 = ligne mensuelle, 1-53 = semaine */
  week: number
  metrics: KpiMetrics
}

interface Props {
  year: number
  site: KpiSite
  /** Commerciaux sélectionnables (vrais users). */
  users: KpiSelectableUser[]
  /** Pré-remplissage en mode édition (clic crayon dans le tableau). */
  draft: KpiEntryDraft | null
  onClose: () => void
  onSaved: () => void
}

/** Saisie / édition manuelle d'un mois de KPI pour un commercial. */
export default function KpiEntryModal({ year, site, users, draft, onClose, onSaved }: Props) {
  const token = useAuthStore((s) => s.token)

  const [userId, setUserId] = useState<number | ''>(draft?.userId ?? '')
  const [month, setMonth] = useState(draft?.month ?? new Date().getMonth() + 1)
  const [week, setWeek] = useState(draft?.week ?? 0)
  const [entrySite, setEntrySite] = useState<KpiSite>(site)
  const [metrics, setMetrics] = useState<KpiMetrics>(draft?.metrics ?? emptyMetrics())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || userId === '') return
    setSaving(true)
    setError(null)
    try {
      await saveKpi(token, { user_id: userId, year, month, week, site: entrySite, ...metrics })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const setMetric = (key: keyof KpiMetrics, raw: string) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0))
    setMetrics((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {draft ? 'Modifier les KPI' : 'Saisie manuelle'}
            </h3>
            <p className="mt-0.5 text-[13px] text-gray-400">Année {year}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-gray-500">Commercial</span>
              <select
                required
                value={userId}
                disabled={!!draft}
                onChange={(e) => setUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors focus:border-blue disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="" disabled>Choisir…</option>
                {draft && !users.some((u) => u.id === draft.userId) && (
                  <option value={draft.userId}>{draft.userName}</option>
                )}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-gray-500">Mois</span>
              <select
                value={month}
                disabled={!!draft}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors focus:border-blue disabled:bg-gray-50 disabled:text-gray-500"
              >
                {MONTH_FULL_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-gray-500">Semaine</span>
              <select
                value={week}
                disabled={!!draft}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors focus:border-blue disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value={0}>Mois entier</option>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>S{w}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-gray-500">Site</span>
              <select
                value={entrySite}
                disabled={!!draft}
                onChange={(e) => setEntrySite(e.target.value as KpiSite)}
                className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors focus:border-blue disabled:bg-gray-50 disabled:text-gray-500"
              >
                {KPI_SITES.map((s) => (
                  <option key={s} value={s}>{SITE_LABELS[s]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {KPI_METRICS.map((m) => (
              <label key={m.key} className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={metrics[m.key]}
                  onChange={(e) => setMetric(m.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors focus:border-blue"
                />
              </label>
            ))}
          </div>

          {error && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || userId === ''}
              className="rounded-lg bg-blue px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
