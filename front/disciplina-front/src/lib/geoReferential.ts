import { useRegionStore, type Region } from '@/store/regionStore'
import { Localisation, TrainingSite } from '@/types/candidate'

/**
 * Référentiel géographique proposé dans les sélecteurs, par tenant. Les enums
 * `Localisation` / `TrainingSite` sont partagés (l'API les valide pour les deux
 * tenants) : chaque tenant n'en propose que sa part. Annemasse : une commune,
 * un site de formation, pas de secteur (cf. AUDIT_MULTITENANT.md §8.1).
 */
const TENANT_LOCALISATIONS: Record<Region, (l: Localisation) => boolean> = {
  reunion: (l) => l !== Localisation.ANNEMASSE,
  annemasse: (l) => l === Localisation.ANNEMASSE,
}

const TENANT_TRAINING_SITES: Record<Region, (s: TrainingSite) => boolean> = {
  reunion: (s) => s !== TrainingSite.ANNEMASSE,
  annemasse: (s) => s === TrainingSite.ANNEMASSE,
}

export function localisationsFor(region: Region | null): Localisation[] {
  return Object.values(Localisation).filter(TENANT_LOCALISATIONS[region ?? 'reunion'])
}

export function trainingSitesFor(region: Region | null): TrainingSite[] {
  return Object.values(TrainingSite).filter(TENANT_TRAINING_SITES[region ?? 'reunion'])
}

/**
 * Lecture instantanée du tenant courant (hors cycle de rendu React) : le tenant est
 * fixé au login et ne change pas tant qu'un écran est monté.
 */
export function currentLocalisations(): Localisation[] {
  return localisationsFor(useRegionStore.getState().region)
}

export function currentTrainingSites(): TrainingSite[] {
  return trainingSitesFor(useRegionStore.getState().region)
}
