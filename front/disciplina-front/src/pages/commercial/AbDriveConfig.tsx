import { useEffect, useState } from 'react'
import { FolderCog, Save, Loader2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { needsAnalysisGraphqlClient } from '@/graphql/client'
import { GET_AB_DRIVE_CONFIG, UPDATE_AB_DRIVE_CONFIG } from '@/graphql/queries'
import { SECTEUR_VALUES } from '@/constants/secteurs'

// Secteurs métier Disciplina (valeurs canoniques côté back : utils/sector.ts).
const SECTORS = SECTEUR_VALUES
const KINDS = ['UNSIGNED', 'SIGNED'] as const
const KIND_LABELS: Record<string, string> = { UNSIGNED: 'Non signé', SIGNED: 'Signé' }

const folderKey = (sector: string, kind: string) => `${sector}_${kind}`

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors font-mono'

export default function AbDriveConfig() {
  const [folders, setFolders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    needsAnalysisGraphqlClient
      .query(GET_AB_DRIVE_CONFIG, {})
      .toPromise()
      .then((res) => {
        if (res.error) {
          setError(res.error.message)
          return
        }
        const cfg = res.data?.abDriveConfig
        if (cfg) {
          const map: Record<string, string> = {}
          for (const f of cfg.sectorFolders ?? []) map[folderKey(f.sector, f.kind)] = f.folderId ?? ''
          setFolders(map)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    const sectorFolders = SECTORS.flatMap((sector) =>
      KINDS.map((kind) => ({
        sector,
        kind,
        folderId: (folders[folderKey(sector, kind)] ?? '').trim() || null,
      })),
    )
    const res = await needsAnalysisGraphqlClient
      .mutation(UPDATE_AB_DRIVE_CONFIG, { input: { sectorFolders } })
      .toPromise()
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 text-purple">
          <FolderCog size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dossiers Drive analyses de besoin</h1>
          <p className="text-sm text-gray-500">
            Deux dossiers Drive par secteur : un pour les AB non signées (à l'envoi en signature) et un pour
            les AB signées (au retour DocuSeal). Chaque AB est archivée dans le dossier du secteur de l'entreprise
            (région de l'AB), pas celui du commercial créateur.
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
        {SECTORS.map((sector) => (
          <div key={sector}>
            <div className="mb-2 text-sm font-semibold text-gray-900">{sector}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {KINDS.map((kind) => (
                <div key={kind}>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {sector} — {KIND_LABELS[kind]}
                  </label>
                  <input
                    className={inputClass}
                    placeholder="ID dossier Drive"
                    value={folders[folderKey(sector, kind)] ?? ''}
                    onChange={(e) =>
                      setFolders((prev) => ({ ...prev, [folderKey(sector, kind)]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
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

      <p className="mt-4 text-xs text-gray-400">
        Astuce : l'ID se trouve dans l'URL du dossier Drive, après <code>/folders/</code>.
      </p>
    </div>
  )
}
