import { useState } from 'react'
import { IconClose } from '@/components/ui/icons'

const ACK_KEY = 'legal-cookie-notice-ack'

/**
 * Bandeau d'information sur les traceurs.
 *
 * Volontairement **informatif** : il n'a aucun effet sur l'initialisation de
 * Sentry (`main.tsx`). Le passage à un consentement bloquant est un chantier
 * distinct (RGPD.md, Faille 9).
 */
export default function CookieBanner() {
  const [acknowledged, setAcknowledged] = useState(
    () => localStorage.getItem(ACK_KEY) === 'true',
  )

  if (acknowledged) return null

  const acknowledge = () => {
    localStorage.setItem(ACK_KEY, 'true')
    setAcknowledged(true)
  }

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className="ds-glass-flush fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ds-glass-border)] px-4 py-3"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <p className="text-[13px] text-[var(--ds-text-muted)]">
          Cette application dépose des cookies strictement nécessaires à votre connexion
          et utilise un outil de supervision technique pour détecter les erreurs.{' '}
          <a
            href="/legal/cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple underline hover:text-purple-dark dark:text-[#c79ede]"
          >
            En savoir plus
          </a>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="rounded-full bg-purple px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-purple-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]"
        >
          J'ai compris
        </button>
        <button
          type="button"
          onClick={acknowledge}
          aria-label="Fermer"
          className="rounded-full p-1 text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text)]"
        >
          <IconClose width={16} height={16} />
        </button>
      </div>
    </div>
  )
}
