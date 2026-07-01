import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider as UrqlProvider } from 'urql'
import './index.css'
import { router } from '@/router'
import { graphqlClient } from '@/graphql/client'
import { installSessionGuard } from '@/lib/sessionGuard'

// Intercepte les 401 REST → fin de session → redirection vers login.
installSessionGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <UrqlProvider value={graphqlClient}>
        <RouterProvider router={router} />
      </UrqlProvider>
  </StrictMode>,
)
