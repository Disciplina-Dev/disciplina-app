import { useEffect, useState } from 'react'
import { FolderCog, Save, Loader2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { candidateGraphqlClient } from '@/graphql/client'
import { GET_DRIVE_FOLDER_CONFIG, UPDATE_DRIVE_FOLDER_CONFIG } from '@/graphql/queries'

// Obligation : abréviations seules (AD, CC, NTC, REM, SA), pas de libellé long.
const TP_ORDER = ['AD', 'CC', 'NTC', 'REM', 'SA']
const REGIONS = ['NORD', 'OUEST', 'SUD']
const REGION_LABELS: Record<string, string> = { NORD: 'Nord', OUEST: 'Ouest', SUD: 'Sud' }

const folderKey = (tp: string, region: string) => `${tp}_${region}`

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-purple transition-colors font-mono'

export default function DriveConfig() {
  const [rootFolderId, setRootFolderId] = useState('')
  const [folders, setFolders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    candidateGraphqlClient
      .query(GET_DRIVE_FOLDER_CONFIG, {})
      .toPromise()
      .then((res) => {
        if (res.error) {
          setError(res.error.message)
          return
        }
        const cfg = res.data?.driveFolderConfig
        if (cfg) {
          setRootFolderId(cfg.rootFolderId ?? '')
          const map: Record<string, string> = {}
          for (const f of cfg.tpFolders ?? []) map[folderKey(f.tp, f.region)] = f.folderId ?? ''
          setFolders(map)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    const tpFolders = TP_ORDER.flatMap((tp) =>
      REGIONS.map((region) => ({
        tp,
        region,
        folderId: (folders[folderKey(tp, region)] ?? '').trim() || null,
      })),
    )
    const input = { rootFolderId: rootFolderId.trim() || null, tpFolders }
    const res = await candidateGraphqlClient.mutation(UPDATE_DRIVE_FOLDER_CONFIG, { input }).toPromise()
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
          <h1 className="text-xl font-semibold text-gray-900">Dossiers Drive candidats</h1>
          <p className="text-sm text-gray-500">
            Un dossier Drive par Titre Professionnel et par région. Un nouveau candidat est classé dans le
            dossier de son TP × région (sinon le dossier racine).
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Dossier racine (fallback)</label>
          <input
            className={inputClass}
            placeholder="ex: 1HhoKUftO46faUSDJRFpOHLOZxCa9FJXe"
            value={rootFolderId}
            onChange={(e) => setRootFolderId(e.target.value)}
          />
        </div>

        <div className="h-px bg-gray-100" />

        {TP_ORDER.map((tp) => (
          <div key={tp}>
            <div className="mb-2 text-sm font-semibold text-gray-900">{tp}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {REGIONS.map((region) => (
                <div key={region}>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {tp} - {REGION_LABELS[region]}
                  </label>
                  <input
                    className={inputClass}
                    placeholder="ID dossier Drive"
                    value={folders[folderKey(tp, region)] ?? ''}
                    onChange={(e) =>
                      setFolders((prev) => ({ ...prev, [folderKey(tp, region)]: e.target.value }))
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
