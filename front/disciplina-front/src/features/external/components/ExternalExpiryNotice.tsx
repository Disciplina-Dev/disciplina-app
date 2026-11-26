import { Hourglass } from 'lucide-react'

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Mention de validité affichée sur les pages accessibles par lien magique :
 * durée illimitée, actif jusqu'à clôture explicite. `expiresAt` n'est
 * renseigné que pour les liens historiques à durée limitée.
 */
export default function ExternalExpiryNotice({ expiresAt }: { expiresAt?: string | null }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--ds-text-subtle)]">
      <Hourglass size={13} className="mt-0.5 shrink-0 text-[var(--ds-text-subtle)]" />
      <span>
        {expiresAt
          ? `Lien historique à durée limitée — il expire le ${formatExpiryDate(expiresAt)}.`
          : 'Ce lien reste valable sans limite de durée, jusqu\u2019à sa clôture.'}
      </span>
    </p>
  )
}
