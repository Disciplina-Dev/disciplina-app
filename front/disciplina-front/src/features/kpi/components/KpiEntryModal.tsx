import { useEffect, useState, type FormEvent } from 'react'
import { IconClose } from '@/components/ui/icons'

import { saveKpi, kpiSitesForRegion, type KpiMetrics, type KpiSelectableUser, type KpiSite } from '@/api/kpi'
import { useRegionStore } from '@/store/regionStore'
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
  const [userId, setUserId] = useState<number | ''>(draft?.userId ?? '')
  const [month, setMonth] = useState(draft?.month ?? new Date().getMonth() + 1)
  const [week, setWeek] = useState(draft?.week ?? 0)
  const [entrySite, setEntrySite] = useState<KpiSite>(site)
  const [metrics, setMetrics] = useState<KpiMetrics>(draft?.metrics ?? emptyMetrics())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sites proposés selon le tenant (le site courant reste sélectionnable
  // même s'il n'appartient pas au référentiel du tenant).
  const region = useRegionStore((s) => s.region)
  const siteOptions = kpiSitesForRegion(region).includes(entrySite)
    ? kpiSitesForRegion(region)
    : [entrySite, ...kpiSitesForRegion(region)]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (userId === '') return
    setSaving(true)
    setError(null)
    try {
      await saveKpi({ user_id: userId, year, month, week, site: entrySite, ...metrics })
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--ds-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--ds-text)]">
              {draft ? 'Modifier les KPI' : 'Saisie manuelle'}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--ds-text-subtle)]">Année {year}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ds-text-subtle)]">Commercial</span>
              <select
                required
                value={userId}
                disabled={!!draft}
                onChange={(e) => setUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none transition-colors focus:border-blue disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
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
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ds-text-subtle)]">Mois</span>
              <select
                value={month}
                disabled={!!draft}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none transition-colors focus:border-blue disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
              >
                {MONTH_FULL_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ds-text-subtle)]">Semaine</span>
              <select
                value={week}
                disabled={!!draft}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none transition-colors focus:border-blue disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
              >
                <option value={0}>Mois entier</option>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>S{w}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ds-text-subtle)]">Site</span>
              <select
                value={entrySite}
                disabled={!!draft}
                onChange={(e) => setEntrySite(e.target.value as KpiSite)}
                className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none transition-colors focus:border-blue disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
              >
                {siteOptions.map((s) => (
                  <option key={s} value={s}>{SITE_LABELS[s]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {KPI_METRICS.map((m) => (
              <label key={m.key} className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ds-text-subtle)]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={metrics[m.key]}
                  onChange={(e) => setMetric(m.key, e.target.value)}
                  className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[13px] text-[var(--ds-text)] outline-none transition-colors focus:border-blue"
                />
              </label>
            ))}
          </div>

          {error && (
            <p className="rounded-lg bg-[var(--ds-danger-bg)] px-3 py-2 text-[13px] text-[var(--ds-danger)]">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)]"
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
