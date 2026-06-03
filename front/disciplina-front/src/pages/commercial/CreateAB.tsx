import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanies } from '@/graphql/hooks'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useCurrentUser } from '@/store/authStore'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import type { Entreprise } from '@/types/entreprise'

export default function CreateAB() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const [selected, setSelected] = useState<Entreprise | null>(null)
  const [search, setSearch] = useState('')

  useCompanies()
  const companies = usePortefeuilleStore((s) => s.companies)

  const filtered = companies.filter((c) =>
    c.nom_commercial?.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
    return (
      <NeedsAnalysisModal
        entreprise={selected}
        currentUser={currentUser}
        onClose={() => setSelected(null)}
        onSuccess={() => navigate('/commercial/analyses-besoin')}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto mt-12 p-6">
      <h1 className="text-2xl font-semibold mb-6">Nouvelle analyse du besoin</h1>
      <input
        type="text"
        placeholder="Rechercher une entreprise..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <ul className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-gray-500 text-sm">Aucune entreprise trouvée</li>
        )}
        {filtered.map((c) => (
          <li
            key={c.id}
            onClick={() => setSelected(c)}
            className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors"
          >
            <span className="font-medium">{c.nom_commercial}</span>
            {c.siret && <span className="ml-2 text-xs text-gray-400">SIRET {c.siret}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
