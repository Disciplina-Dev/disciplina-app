import { Clock, CheckCircle, Phone, Calendar, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import { useRelances, useUpdateRelance } from '@/hooks/useCompanies'
import type { Relance } from '@/types/api'

const TODAY = new Date().toISOString().slice(0, 10)
const WEEK_END = (() => {
  const d = new Date()
  d.setDate(d.getDate() + (7 - d.getDay()))
  return d.toISOString().slice(0, 10)
})()

const dateOf = (r: Relance) => r.scheduled_date.slice(0, 10)

const GROUPS = [
  { label: "Aujourd'hui / En retard", filter: (r: Relance) => dateOf(r) <= TODAY },
  { label: 'Cette semaine',           filter: (r: Relance) => dateOf(r) > TODAY && dateOf(r) <= WEEK_END },
  { label: 'Plus tard',               filter: (r: Relance) => dateOf(r) > WEEK_END },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Relances() {
  const { data, isLoading, isError } = useRelances()
  const updateRelance = useUpdateRelance()

  const relances = (data?.data ?? []).filter(r => r.statut === 'planifiee')
  const urgent   = relances.filter(r => dateOf(r) <= TODAY)

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Chargement…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-8 text-danger text-sm">
        Impossible de charger les relances. Vérifiez que le serveur est démarré.
      </div>
    )
  }

  return (
    <div className="p-8 space-y-7 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black">Relances</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {relances.length} relance{relances.length > 1 ? 's' : ''} planifiée{relances.length > 1 ? 's' : ''} · {urgent.length} urgente{urgent.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Urgent banner */}
      {urgent.length > 0 && (
        <div className="bg-danger-bg border border-danger/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-danger/10 rounded-lg flex items-center justify-center shrink-0">
            <Clock size={15} className="text-danger" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">
              {urgent.length} relance{urgent.length > 1 ? 's' : ''} à faire aujourd'hui
            </p>
            <p className="text-xs text-danger/70 mt-0.5">
              {urgent.map(r => r.raison_sociale).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-7">
        {relances.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">Aucune relance planifiée</div>
        )}
        {GROUPS.map(({ label, filter }) => {
          const items = relances.filter(filter)
          if (items.length === 0) return null
          return (
            <div key={label}>
              <div className="flex items-center gap-3 mb-3">
                <Calendar size={13} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2.5">
                {items.map(r => {
                  const isUrgent = dateOf(r) <= TODAY
                  const isPending = updateRelance.isPending && (updateRelance.variables as { id: number })?.id === r.id
                  return (
                    <div
                      key={r.id}
                      className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-sm ${
                        isUrgent ? 'border-danger/25' : 'border-gray-100'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isUrgent ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'
                      }`}>
                        <Clock size={15} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{r.raison_sociale ?? '—'}</p>
                          {isUrgent && (
                            <span className="text-[10px] font-bold text-danger bg-danger-bg px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes ?? '—'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-300">{r.commercial_nom ?? '—'}</p>
                          <span className="text-xs text-gray-300">·</span>
                          <p className="text-xs text-gray-300">{formatDate(r.scheduled_date)}</p>
                        </div>
                      </div>

                      {r.statut_entreprise && <Badge status={r.statut_entreprise} />}

                      <div className="flex gap-2 shrink-0">
                        <Link to={`/commercial/portefeuille/${r.entreprise_id}`}>
                          <Button variant="secondary" size="sm" leftIcon={<Phone size={12} />}>
                            Appeler
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<CheckCircle size={12} />}
                          isLoading={isPending}
                          onClick={() => updateRelance.mutate({ id: r.id, statut: 'faite' })}
                        >
                          Fait
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
