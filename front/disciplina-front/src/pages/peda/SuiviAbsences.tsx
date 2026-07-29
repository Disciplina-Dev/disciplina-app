import { useEffect, useState } from 'react'
import { FileSpreadsheet, Clock, Save, Loader2, PlayCircle, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import {
  fetchPedaConfig, savePedaSheet, deletePedaSheet,
  fetchDraftHour, saveDraftHour, runDraftJobNow,
  type PedaDraftRunReport,
} from '@/api/peda'

const inputClass =
  'w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-teal-700 transition-colors'

/**
 * Config du suivi d'absences : lien du Google Sheet du Peda connecté,
 * heure globale du job quotidien, et déclenchement manuel.
 */
export default function SuiviAbsences() {
  const [sheetLink, setSheetLink] = useState('')
  const [savedSheetId, setSavedSheetId] = useState<string | null>(null)
  const [hour, setHour] = useState('08:00')
  const [loading, setLoading] = useState(true)
  const [savingSheet, setSavingSheet] = useState(false)
  const [savingHour, setSavingHour] = useState(false)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<PedaDraftRunReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchPedaConfig(), fetchDraftHour()])
      .then(([config, h]) => {
        setSavedSheetId(config.sheetId)
        setHour(h)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function flash(msg: string) {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess((s) => (s === msg ? null : s)), 2500)
  }

  async function handleSaveSheet() {
    if (!sheetLink.trim()) return
    setSavingSheet(true)
    setError(null)
    try {
      const { sheetId } = await savePedaSheet(sheetLink)
      setSavedSheetId(sheetId)
      setSheetLink('')
      flash('Google Sheet enregistré')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de l’enregistrement')
    } finally {
      setSavingSheet(false)
    }
  }

  async function handleDeleteSheet() {
    setError(null)
    try {
      await deletePedaSheet()
      setSavedSheetId(null)
      flash('Google Sheet retiré')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression')
    }
  }

  async function handleSaveHour() {
    setSavingHour(true)
    setError(null)
    try {
      await saveDraftHour(hour)
      flash('Heure du job enregistrée')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de l’enregistrement')
    } finally {
      setSavingHour(false)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    setError(null)
    setReport(null)
    try {
      setReport(await runDraftJobNow())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de l’exécution')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-teal-700" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Suivi des absences</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Chaque jour à l’heure configurée, des brouillons Gmail de relance sont créés dans votre boîte
          à partir des cases « Mail niv » cochées dans votre Google Sheet. Le Sheet n’est jamais modifié.
        </p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-xs text-teal-700"><CheckCircle2 size={14} /> {success}</p>
      )}

      {/* ── Google Sheet ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-teal-700" />
          <h2 className="text-base font-bold text-gray-800">Mon Google Sheet d’absences</h2>
        </div>
        {savedSheetId ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-gray-100 px-4 py-2.5">
            <span className="text-sm text-gray-700 flex-1 truncate font-mono">{savedSheetId}</span>
            <a
              href={`https://docs.google.com/spreadsheets/d/${savedSheetId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-teal-700 hover:underline shrink-0"
            >
              Ouvrir
            </a>
            <button onClick={handleDeleteSheet} className="text-gray-400 hover:text-red-500 transition-colors" title="Retirer">
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun Sheet enregistré pour l’instant.</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={sheetLink}
            onChange={(e) => setSheetLink(e.target.value)}
            placeholder="Collez le lien (ou l’ID) de votre Google Sheet"
            className={inputClass}
          />
          <Button size="sm" leftIcon={<Save size={15} />} isLoading={savingSheet} onClick={handleSaveSheet} disabled={!sheetLink.trim()}>
            Enregistrer
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          Feuilles lues : Abs NTC · Abs AD · Abs CC · Abs REM (en-têtes ligne 6, données dès la ligne 7).
        </p>
      </section>

      {/* ── Heure globale ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-teal-700" />
          <h2 className="text-base font-bold text-gray-800">Heure du job quotidien</h2>
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          Commune à tous les Pedas · heure de La Réunion
        </p>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-700 transition-colors"
          />
          <Button size="sm" leftIcon={<Save size={15} />} isLoading={savingHour} onClick={handleSaveHour}>
            Enregistrer
          </Button>
        </div>
      </section>

      {/* ── Exécution manuelle ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <PlayCircle size={16} className="text-teal-700" />
          <h2 className="text-base font-bold text-gray-800">Lancer maintenant</h2>
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          Génère immédiatement les brouillons dans votre boîte Gmail (les cases déjà traitées sont ignorées).
        </p>
        <div>
          <Button size="sm" leftIcon={<PlayCircle size={15} />} isLoading={running} onClick={handleRunNow}>
            Générer les brouillons
          </Button>
        </div>
        {report && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-xs font-semibold text-gray-700">
              {report.created} brouillon(s) créé(s)
            </p>
            {/* Détail du parcours : permet de comprendre un « 0 brouillon » sans lire les logs. */}
            <ul className="text-[11px] text-gray-500 flex flex-col gap-0.5">
              <li>{report.tabsRead} feuille(s) lue(s){report.tabsFailed > 0 && `, ${report.tabsFailed} en échec`}</li>
              <li>{report.rowsScanned} apprenant(s) parcouru(s) · {report.boxesChecked} case(s) « Mail niv » cochée(s)</li>
              <li>
                {report.skippedExisting} déjà traité(s) · {report.skippedNoTemplate} sans modèle ·{' '}
                {report.skippedNoMail} sans adresse mail · {report.errors} erreur(s)
              </li>
            </ul>
            {report.details.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-gray-100 pt-2">
                {report.details.map((d) => (
                  <li key={d} className="flex gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
