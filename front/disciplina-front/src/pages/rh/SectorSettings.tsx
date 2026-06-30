import { useEffect, useState } from 'react'
import { MapPin, Save, Loader2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { fetchSectorSettings, updateSectorSettings, type SectorSetting } from '@/api/sectorSettings'

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors'

export default function SectorSettings() {
  const token = useAuthStore((s) => s.token)
  const [settings, setSettings] = useState<SectorSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetchSectorSettings(token)
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSave = async () => {
    if (!token) return
    setSaving(true); setError(null); setSaved(false)
    try {
      const updated = await updateSectorSettings(token, settings)
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
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 text-purple">
          <MapPin size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lieux de rendez-vous par secteur</h1>
          <p className="text-sm text-gray-500">
            Lieu pré-rempli lors d'une prise de rendez-vous, selon le secteur du RH/responsable hôte.
            Reste modifiable au cas par cas.
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
        {settings.map((s) => (
          <div key={s.sector}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{s.sector}</label>
            <input
              className={inputClass}
              placeholder="Adresse / intitulé du lieu"
              value={s.location}
              onChange={(e) => patch(s.sector, e.target.value)}
            />
          </div>
        ))}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} isLoading={saving} leftIcon={<Save size={16} />}>
            Enregistrer
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 size={16} /> Enregistré
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
