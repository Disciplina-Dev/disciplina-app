import { Client, cacheExchange, fetchExchange } from 'urql'
import { useAuthStore } from '@/store/authStore'

const getFetchOptions = () => {
  const token = useAuthStore.getState().token
  if (token) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  }
  return {}
}

export const graphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/companies', // Consider dynamic mapping here
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: getFetchOptions,
})

// Client dédié aux candidats (MongoDB – endpoint séparé)
export const candidateGraphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/candidates',
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: getFetchOptions,
})

export const userGraphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/users',
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: getFetchOptions,
})

// Client dédié aux jobs (matching – endpoint séparé)
export const jobGraphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/jobs',
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: getFetchOptions,
})
