import { Hourglass } from 'lucide-react'

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Avertissement d'expiration affiché sur les pages accessibles par lien
 * magique : le lien est valable 7 jours après sa première ouverture.
 */
export default function ExternalExpiryNotice({ expiresAt }: { expiresAt?: string | null }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12px] text-gray-500">
      <Hourglass size={13} className="mt-0.5 shrink-0 text-gray-400" />
      <span>
        Ce lien est valable 7 jours après sa première ouverture
        {expiresAt ? ` — il expire le ${formatExpiryDate(expiresAt)}.` : '.'}
      </span>
    </p>
  )
}
