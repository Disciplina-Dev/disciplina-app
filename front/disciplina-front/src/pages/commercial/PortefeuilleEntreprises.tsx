import { useState } from 'react'
import { Search, Plus, Building2, ChevronRight, SlidersHorizontal, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import { useCompanies } from '@/hooks/useCompanies'
import type { CompanyStatus } from '@/types/api'

type TabValue = 'tous' | CompanyStatus

const TABS: { value: TabValue; label: string }[] = [
  { value: 'tous',       label: 'Tous' },
  { value: 'prospect',   label: 'Prospects' },
  { value: 'contacte',   label: 'Contactés' },
  { value: 'ok',         label: 'OK' },
  { value: 'indecis',    label: 'Indécis' },
  { value: 'non',        label: 'Non' },
  { value: 'partenaire', label: 'Partenaires' },
]

const SOURCE_LABELS: Record<string, string> = {
  pages_jaunes: 'Pages Jaunes',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  facebook: 'Facebook',
  listing_lorenzo: 'Listing Lorenzo',
  france_travail: 'France Travail',
  recommandation: 'Recommandation',
  autre: 'Autre',
}

export default function PortefeuilleEntreprises() {
  const [tab, setTab]       = useState<TabValue>('tous')
  const [search, setSearch] = useState('')

  // On récupère toutes les entreprises pour le comptage des tabs
  const { data: allData } = useCompanies()
  // Requête filtrée pour le tableau
  const { data, isLoading, isError } = useCompanies({
    statut: tab === 'tous' ? undefined : tab,
    search: search || undefined,
  })

  const companies = data?.data ?? []
  const allCompanies = allData?.data ?? []

  const countFor = (v: TabValue) =>
    v === 'tous'
      ? allCompanies.length
      : allCompanies.filter(e => e.statut === v).length

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black">Portefeuille</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {allCompanies.length} entreprise{allCompanies.length > 1 ? 's' : ''} · CRM Commercial
          </p>
        </div>
        <Link to="/commercial/portefeuille/nouvelle">
          <Button leftIcon={<Plus size={14} />}>Nouvelle entreprise</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une entreprise…"
            className="w-full pl-9 pr-4 h-10 bg-white border border-gray-100 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-all"
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<SlidersHorizontal size={13} />}>
          Filtres
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100">
        {TABS.map(({ value, label }) => {
          const count  = countFor(value)
          const active = tab === value
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                active
                  ? 'text-blue border-blue'
                  : 'text-gray-400 border-transparent hover:text-gray-700'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                active ? 'bg-blue text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-danger text-sm">
            Impossible de charger les entreprises. Vérifiez que le serveur est démarré.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Entreprise</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">SIRET</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Commercial</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                <th className="py-3 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    Aucune entreprise trouvée
                  </td>
                </tr>
              ) : (
                companies.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-gray-50/60 transition-colors ${
                      i < companies.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-light rounded-lg flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-blue" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{e.raison_sociale}</p>
                          <p className="text-xs text-gray-400">
                            {e.secteur ?? '—'}{e.commune ? ` · ${e.commune}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-mono text-gray-400">{e.siret ?? '—'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Badge status={e.statut} />
                        {e.relances_count > 0 && (
                          <span className="text-[10px] font-bold text-warning bg-warning-bg px-1.5 py-0.5 rounded-full">
                            {e.relances_count} relance{e.relances_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-gray-600">
                      {e.commercial_nom ?? '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {e.source ? (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                          {SOURCE_LABELS[e.source] ?? e.source}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/commercial/portefeuille/${e.id}`}>
                        <button className="p-1.5 rounded-lg text-gray-300 hover:text-blue hover:bg-blue-light/50 transition-all">
                          <ChevronRight size={15} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
