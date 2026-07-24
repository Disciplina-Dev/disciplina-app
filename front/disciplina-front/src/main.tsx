import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider as UrqlProvider } from 'urql'
import './index.css'
import { router } from '@/router'
import { graphqlClient } from '@/graphql/client'
import { installSessionGuard } from '@/lib/sessionGuard'
import { AuthBootstrap } from '@/components/AuthBootstrap'

// Intercepte les 401 (REST + GraphQL) → refresh silencieux ou fin de session.
installSessionGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <UrqlProvider value={graphqlClient}>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
      </UrqlProvider>
  </StrictMode>,
)
