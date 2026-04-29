import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider as UrqlProvider } from 'urql'
import './index.css'
import { router } from '@/router'
import { graphqlClient } from '@/graphql/client'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = "117595432602-lmkj391tbf8v204jb6h39f71tbmujf9o.apps.googleusercontent.com"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <UrqlProvider value={graphqlClient}>
        <RouterProvider router={router} />
      </UrqlProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
