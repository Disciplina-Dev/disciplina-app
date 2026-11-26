import { useEffect, useState } from 'react'
import { IconCheckCircle, IconLoader, IconMapPin, IconSave } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import { fetchSectorSettings, updateSectorSettings, type SectorSetting } from '@/api/sectorSettings'

const inputClass =
  'w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none focus:border-purple transition-colors'

export default function SectorSettings() {
  const [settings, setSettings] = useState<SectorSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSectorSettings()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const updated = await updateSectorSettings(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const patch = (sector: string, location: string) =>
    setSettings((prev) => prev.map((s) => (s.sector === sector ? { ...s, location } : s)))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--ds-text-subtle)]">
        <IconLoader className="animate-spin" width={22} height={22} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 text-purple">
          <IconMapPin width={20} height={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--ds-text)]">Lieux de rendez-vous par secteur</h1>
          <p className="text-sm text-[var(--ds-text-subtle)]">
            Lieu pré-rempli lors d'une prise de rendez-vous, selon le secteur du RH/responsable hôte.
            Reste modifiable au cas par cas.
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6">
        {settings.map((s) => (
          <div key={s.sector}>
            <label className="mb-1 block text-sm font-medium text-[var(--ds-text-muted)]">{s.sector}</label>
            <input
              className={inputClass}
              placeholder="Adresse / intitulé du lieu"
              value={s.location}
              onChange={(e) => patch(s.sector, e.target.value)}
            />
          </div>
        ))}

        {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} isLoading={saving} leftIcon={<IconSave width={16} height={16} />}>
            Enregistrer
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-[var(--ds-success)]">
              <IconCheckCircle width={16} height={16} /> Enregistré
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
