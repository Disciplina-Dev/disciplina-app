import { useState } from 'react'
import { X } from 'lucide-react'

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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <p className="text-[13px] text-gray-700">
          Cette application dépose des cookies strictement nécessaires à votre connexion
          et utilise un outil de supervision technique pour détecter les erreurs.{' '}
          <a
            href="/legal/cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple underline hover:text-purple-dark"
          >
            En savoir plus
          </a>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="rounded bg-purple px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-purple-dark"
        >
          J'ai compris
        </button>
        <button
          type="button"
          onClick={acknowledge}
          aria-label="Fermer"
          className="text-gray-300 transition-colors hover:text-gray-700"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
