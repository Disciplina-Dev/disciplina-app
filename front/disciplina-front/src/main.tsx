import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider as UrqlProvider } from 'urql'
import './index.css'
import { router } from '@/router'
import { graphqlClient } from '@/graphql/client'
import { installSessionGuard } from '@/lib/sessionGuard'
import { AuthBootstrap } from '@/components/AuthBootstrap'
import CookieBanner from '@/components/legal/CookieBanner'

Sentry.init({
    // TODO: supprimer le fallback et ne garder que VITE_SENTRY_DSN dans .env en production
    dsn: import.meta.env.VITE_SENTRY_DSN,
    release: import.meta.env.VITE_SENTRY_RELEASE ?? 'dev',

    // Pour désactiver l'envoi des données utilisateur / corps HTTP, décommentez les
    // lignes ci-dessous. https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    dataCollection: {
        // userInfo: false,
        // httpBodies: [],
    },
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        // Optionnel : ajoute un span "route change" pour chaque navigation React Router.
        // Voir https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/
    ],
    // Trace sampling (0 = never, 1 = always).
    // Adjust in production (ex. 0.1 = 10 %) :
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 1.0),
    tracePropagationTargets: ['localhost', /^https:\/\/app-reunion.disciplina.re\/api/],
    // Session Replay — sampling
    replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0.1),
    replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1.0),
    // Send console logs to Sentry
    enableLogs: true,
    debug: true,
})

// Intercept 401s (REST + GraphQL) → silent refresh or session end.
installSessionGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <UrqlProvider value={graphqlClient}>
        <AuthBootstrap>
          <RouterProvider router={router} />
          <CookieBanner />
        </AuthBootstrap>
      </UrqlProvider>
  </StrictMode>,
)
