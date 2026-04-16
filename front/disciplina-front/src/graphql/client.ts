import { Client, cacheExchange, fetchExchange } from 'urql'

export const graphqlClient = new Client({
  url: 'http://localhost:4000/api/graphql/companies',
  exchanges: [cacheExchange, fetchExchange],
})
