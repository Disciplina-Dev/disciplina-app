import { lazy, type ComponentType } from 'react'

/**
 * Wrappe React.lazy pour gérer les chunks périmés après un nouveau déploiement.
 *
 * Après un deploy, l'index.html en cache du navigateur référence des chunks aux
 * hashes qui n'existent plus sur le CDN → "Failed to fetch dynamically imported
 * module". On recharge alors la page une seule fois pour récupérer le nouvel
 * index.html (garde anti-boucle via sessionStorage).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const KEY = 'chunk-reload'
    try {
      const component = await factory()
      window.sessionStorage.removeItem(KEY)
      return component
    } catch (error) {
      const alreadyReloaded = window.sessionStorage.getItem(KEY) === 'true'
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(KEY, 'true')
        window.location.reload()
        // Reload en cours : renvoie une promesse jamais résolue.
        return new Promise<{ default: T }>(() => {})
      }
      throw error
    }
  })
}
