import { Client, cacheExchange, fetchExchange, mapExchange, CombinedError } from 'urql'
import { useAuthStore, handleSessionExpired } from '@/store/authStore'

const getFetchOptions = () => {
  const token = useAuthStore.getState().token
  return {
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
}

// Le contexte GraphQL renvoie une erreur "Unauthorized" (HTTP 200) quand le JWT
// est expiré/invalide ; le fetchExchange peut aussi remonter un 401 réseau.
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
export const jobGraphqlClient = new Client({
  url: `${import.meta.env.VITE_API_URL}/api/graphql/jobs`,
  exchanges,
  fetchOptions: getFetchOptions,
})
