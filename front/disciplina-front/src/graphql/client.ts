import { Client, cacheExchange, fetchExchange, mapExchange, CombinedError } from 'urql'
import { handleSessionExpired } from '@/store/authStore'
import { CSRF_HEADER, getCsrfCookie } from '@/lib/csrf'

const getFetchOptions = () => {
  const csrf = getCsrfCookie()
  return {
    method: 'POST' as const,
    credentials: 'include' as const,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
    },
  }
}

// Le contexte GraphQL renvoie une erreur "Unauthorized" (HTTP 200) quand le JWT
// est expiré/invalide ; le fetchExchange peut aussi remonter un 401 réseau.
// Le retry-après-refresh transparent se fait déjà au niveau window.fetch
// (lib/sessionGuard.ts, seul point qui voit tous les fetches y compris ceux
// d'urql) : si une erreur d'auth arrive quand même jusqu'ici, le refresh a
// déjà été tenté et a échoué — il ne reste qu'à terminer la session.
function isAuthError(error: CombinedError): boolean {
  if (error.response?.status === 401) return true
  return error.graphQLErrors.some((e) => /unauthorized|no valid session/i.test(e.message))
}

const authExchange = mapExchange({
  onError(error) {
    if (isAuthError(error)) handleSessionExpired()
  },
})

const exchanges = [cacheExchange, authExchange, fetchExchange]

export const graphqlClient = new Client({
  url: `${import.meta.env.VITE_API_URL}/api/graphql/companies`,
  exchanges,
  fetchOptions: getFetchOptions,
})

// Client dédié aux candidats (MongoDB – endpoint séparé)
export const candidateGraphqlClient = new Client({
  url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates`,
  exchanges,
  fetchOptions: getFetchOptions,
})

// Client dédié aux jobs (matching – endpoint séparé)
export const offerGraphqlClient = new Client({
  url: `${import.meta.env.VITE_API_URL}/api/graphql/offers`,
  exchanges,
  fetchOptions: getFetchOptions,
})

// Client dédié aux analyses de besoins (endpoint séparé)
export const NEEDS_ANALYSIS_URL = `${import.meta.env.VITE_API_URL}/api/graphql/needs-analysis`
export const needsAnalysisGraphqlClient = new Client({
  url: NEEDS_ANALYSIS_URL,
  exchanges,
  fetchOptions: getFetchOptions,
})
