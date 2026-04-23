import { Client, cacheExchange, fetchExchange } from 'urql'

export const graphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/companies',
  exchanges: [cacheExchange, fetchExchange],
})

// Client dédié aux candidats (MongoDB – endpoint séparé)
export const candidateGraphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/candidates',
  exchanges: [cacheExchange, fetchExchange],
})
