import { useParams, Link } from 'react-router-dom'
import LegalLayout from '@/components/legal/LegalLayout'
import LegalDocument from '@/components/legal/LegalDocument'
import socle from '@/content/legal/cgu/socle.md?raw'
import annexeCandidat from '@/content/legal/cgu/annexe-candidat.md?raw'
import annexeEntreprise from '@/content/legal/cgu/annexe-entreprise.md?raw'
import annexeInterne from '@/content/legal/cgu/annexe-interne.md?raw'

const ANNEXES = {
  candidat: { label: 'Candidat', source: annexeCandidat },
  entreprise: { label: 'Entreprise', source: annexeEntreprise },
  interne: { label: 'Utilisateur interne', source: annexeInterne },
} as const

type Audience = keyof typeof ANNEXES

function isAudience(value: string | undefined): value is Audience {
  return value !== undefined && value in ANNEXES
}

export default function CguPage() {
  const { audience } = useParams()
  const selected = isAudience(audience) ? audience : null

  const source = selected ? `${socle}\n\n---\n\n${ANNEXES[selected].source}` : socle

  return (
    <LegalLayout title="Conditions d'utilisation">
      <nav aria-label="Choix de l'annexe" className="mb-8">
        <p className="mb-2 text-[13px] text-gray-500">
          Les conditions se composent d'un socle commun et d'une annexe propre à votre
          situation :
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/legal/cgu"
            className={
              selected === null
                ? 'rounded border border-purple bg-purple-light px-3 py-1.5 text-[13px] font-bold text-purple-dark'
                : 'rounded border border-gray-100 px-3 py-1.5 text-[13px] text-gray-700 transition-colors hover:border-gray-300'
            }
          >
            Socle commun
          </Link>
          {(Object.keys(ANNEXES) as Audience[]).map((key) => (
            <Link
              key={key}
              to={`/legal/cgu/${key}`}
              className={
                selected === key
                  ? 'rounded border border-purple bg-purple-light px-3 py-1.5 text-[13px] font-bold text-purple-dark'
                  : 'rounded border border-gray-100 px-3 py-1.5 text-[13px] text-gray-700 transition-colors hover:border-gray-300'
              }
            >
              {ANNEXES[key].label}
            </Link>
          ))}
        </div>
      </nav>

      <LegalDocument source={source} />
    </LegalLayout>
  )
}
