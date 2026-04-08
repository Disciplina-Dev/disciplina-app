import { Building2, FileText, Bell, TrendingUp, Plus, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import { useCompanies, useRelances } from '@/hooks/useCompanies'
import { CURRENT_USER } from '@/constants/currentUser'
import type { CompanyStatus } from '@/types/api'

const TODAY = new Date().toISOString().slice(0, 10)

const BAR_COLOR: Record<CompanyStatus, string> = {
  prospect:   'bg-gray-300',
  contacte:   'bg-blue',
  ok:         'bg-success',
  indecis:    'bg-warning',
  non:        'bg-danger',
  partenaire: 'bg-purple',
}

const PIPELINE_LABELS: { status: CompanyStatus; label: string }[] = [
  { status: 'prospect',   label: 'Prospects' },
  { status: 'contacte',   label: 'Contactés' },
  { status: 'ok',         label: 'OK — AB en cours' },
  { status: 'indecis',    label: 'Indécis' },
  { status: 'non',        label: 'Non' },
  { status: 'partenaire', label: 'Partenaires' },
]

export default function DashboardCommercial() {
  const { data: allData, isLoading: loadingCompanies } = useCompanies()
  const { data: relancesData, isLoading: loadingRelances } = useRelances()

  const companies = allData?.data ?? []
  const relances  = relancesData?.data ?? []

  const planifiees  = relances.filter(r => r.statut === 'planifiee')
  const urgentes    = planifiees.filter(r => r.scheduled_date.slice(0, 10) <= TODAY)
  const partenaires = companies.filter(e => e.statut === 'ok' || e.statut === 'partenaire')
  const taux        = companies.length > 0
    ? Math.round((partenaires.length / companies.length) * 100)
    : 0

  const upcoming = planifiees
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 3)

  const pipeline = PIPELINE_LABELS.map(({ status, label }) => ({
    status,
    label,
    count: companies.filter(e => e.statut === status).length,
  }))

  const maxPipeline = Math.max(...pipeline.map(p => p.count), 1)

  const STATS = [
    { label: 'Entreprises suivies', value: companies.length,   delta: `${companies.filter(e => e.statut !== 'non').length} actives`, icon: Building2, accent: 'bg-blue-light text-blue' },
    { label: 'Partenaires / OK',    value: partenaires.length, delta: `${taux}% conversion`,          icon: FileText,  accent: 'bg-success-bg text-success' },
    { label: 'Relances planifiées', value: planifiees.length,  delta: `${urgentes.length} urgente${urgentes.length > 1 ? 's' : ''}`, icon: Bell, accent: 'bg-warning-bg text-warning' },
    { label: 'Taux de conversion',  value: `${taux}%`,         delta: `${partenaires.length} OK/partenaires`, icon: TrendingUp, accent: 'bg-purple-light text-purple' },
  ]

  const isLoading = loadingCompanies || loadingRelances

  return (
    <div className="p-8 space-y-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Bonjour {CURRENT_USER.name} — activité du jour</p>
        </div>
        <Link to="/commercial/portefeuille/nouvelle">
          <Button leftIcon={<Plus size={14} />}>Nouvelle entreprise</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {STATS.map(({ label, value, delta, icon: Icon, accent }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${accent}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs text-gray-400">{delta}</span>
                </div>
                <p className="text-3xl font-black text-black tracking-tight">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Pipeline + Upcoming */}
          <div className="grid grid-cols-5 gap-5">
            <div className="col-span-3 bg-white border border-gray-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">Pipeline commercial</h3>
                <Link to="/commercial/portefeuille" className="flex items-center gap-1 text-xs text-blue hover:text-blue-dark">
                  Voir tout <ChevronRight size={12} />
                </Link>
              </div>
              <div className="space-y-3.5">
                {pipeline.map(({ label, count, status }) => (
                  <div key={status} className="flex items-center gap-3">
                    <p className="w-36 text-sm text-gray-600 truncate shrink-0">{label}</p>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${BAR_COLOR[status]}`} style={{ width: `${(count / maxPipeline) * 100}%` }} />
                    </div>
                    <Badge status={status} />
                    <span className="text-sm font-bold text-black w-5 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming relances */}
            <div className="col-span-2 bg-white border border-gray-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Relances à venir</h3>
                <Link to="/commercial/relances">
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight size={13} />}>
                    Toutes
                  </Button>
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucune relance planifiée</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(r => {
                    const isUrgent = r.scheduled_date.slice(0, 10) <= TODAY
                    const dateLabel = isUrgent
                      ? "Aujourd'hui"
                      : new Date(r.scheduled_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    return (
                      <Link
                        key={r.id}
                        to={`/commercial/portefeuille/${r.entreprise_id}`}
                        className="flex items-start gap-3 p-3.5 border border-gray-100 rounded-xl hover:border-blue/30 hover:bg-blue-light/10 transition-all group"
                      >
                        <div className="w-8 h-8 bg-warning-bg rounded-lg flex items-center justify-center shrink-0">
                          <Clock size={14} className="text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue transition-colors">
                            {r.raison_sociale ?? '—'}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{r.notes ?? '—'}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs font-semibold ${isUrgent ? 'text-danger' : 'text-warning'}`}>{dateLabel}</span>
                            {r.statut_entreprise && <Badge status={r.statut_entreprise} />}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
