import { create } from 'zustand'
import { graphqlClient } from '@/graphql/client'
import { GET_SECTORS } from '@/graphql/queries'
import { useRegionStore, type Region } from '@/store/regionStore'

export interface SectorNode {
  id: number
  code: string
  label: string
  level: 'region' | 'sector' | 'commune'
  parentId: number | null
}

interface SectorState {
  /** Tenant auquel appartiennent `nodes` (null tant que rien n'est chargé). */
  loadedRegion: Region | null
  nodes: SectorNode[]
  load: (region: Region) => Promise<void>
  reset: () => void
}

let inflight: { region: Region; promise: Promise<void> } | null = null

export const useSectorStore = create<SectorState>((set, get) => ({
  loadedRegion: null,
  nodes: [],

  // Idempotent : un seul appel réseau par tenant, partagé par tous les composants.
  // En cas d'échec le repli sur les constantes reste actif ; un nouveau tenant relance.
  load: (region) => {
    if (get().loadedRegion === region) return Promise.resolve()
    if (inflight?.region === region) return inflight.promise
    const promise = graphqlClient
      .query(GET_SECTORS, {}, { requestPolicy: 'network-only' })
      .toPromise()
      .then((result) => {
        const nodes = result.data?.sectors as SectorNode[] | undefined
        // Le tenant a pu changer pendant la requête : on ne publie pas un arbre périmé.
        if (nodes && inflight?.region === region) set({ nodes, loadedRegion: region })
      })
      .finally(() => {
        if (inflight?.region === region) inflight = null
      })
    inflight = { region, promise }
    return promise
  },

  reset: () => {
    inflight = null
    set({ loadedRegion: null, nodes: [] })
  },
}))

// Le référentiel est propre au tenant : un changement de région l'invalide.
useRegionStore.subscribe((state, prev) => {
  if (state.region !== prev.region) useSectorStore.getState().reset()
})
