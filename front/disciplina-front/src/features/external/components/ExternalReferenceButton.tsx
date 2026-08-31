import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

interface ExternalReferenceButtonProps {
  referenceId: number
  referenceKey: string
}

// Redirige vers l'objet métier référencé par un accès externe, selon le type de référence :
// 1 = IMPORT_CV (candidat), 2 = MATCHING (offre/entreprise), 3 = INTERVIEW_SLOTS (candidat).
export default function ExternalReferenceButton({ referenceId, referenceKey }: ExternalReferenceButtonProps) {
  const navigate = useNavigate()

  const target = (): string | null => {
    if (!referenceKey) return null
    if (referenceId === 1 || referenceId === 3) return `/rh/candidats/${encodeURIComponent(referenceKey)}`
    if (referenceId === 2) return `/rh/matching`
    return null
  }

  const to = target()
  if (!to) return null

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      title="Ouvrir l'objet référencé"
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-purple hover:bg-purple-light/50 transition-colors"
    >
      <ExternalLink size={14} />
      Voir
    </button>
  )
}
