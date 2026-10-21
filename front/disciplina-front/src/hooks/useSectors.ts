import { useEffect, useMemo } from 'react'
import { useRegionStore } from '@/store/regionStore'
import { useSectorStore } from '@/store/sectorStore'
import {
  ANNEMASSE_DRIVE_REGION,
  companySecteursForRegion,
  defaultCompanySecteurForRegion,
  driveRegionsForRegion,
  SECTEUR_LABELS,
  userSecteursForRegion,
  type SecteurKey,
} from '@/constants/secteurs'
import { kpiSitesForRegion, KPI_SITE_LABELS } from '@/api/kpi'

/**
 * Vocabulaire des secteurs du tenant courant, lu depuis le référentiel back
 * (query `sectors`). Tant qu'il n'est pas chargé (ou en cas d'échec), repli sur
 * les constantes de `constants/secteurs.ts`. Les valeurs échangées avec le back
 * restent les libellés historiques.
 */
export interface SectorsView {
  /** true quand les valeurs viennent du référentiel (et non du repli). */
  loaded: boolean
  /** Libellés des secteurs entreprise. */
  companySectors: string[]
  defaultCompanySector: string
  /** Libellés des secteurs utilisateur (Annemasse : la région, secteur unique). */
  userSectors: string[]
  /** Clés de région Drive (NORD/OUEST/SUD ou ANNEMASSE). */
  driveRegions: string[]
  /** Sites KPI (mêmes clés que les régions Drive). */
  kpiSites: string[]
  /** Libellé d'une clé de secteur (NORD → « Nord-Est »), la clé si inconnue. */
  labelOf: (code: string) => string
  /** Codes des communes d'un secteur (vide si inconnu ou non chargé). */
  communesOf: (sectorCode: string) => string[]
}

export function useSectors(): SectorsView {
  const region = useRegionStore((s) => s.region)
  const nodes = useSectorStore((s) => s.nodes)
  const loadedRegion = useSectorStore((s) => s.loadedRegion)
  const load = useSectorStore((s) => s.load)

  useEffect(() => {
    if (region) void load(region)
  }, [region, load])

  const loaded = region !== null && loadedRegion === region

  return useMemo(() => {
    const fallbackLabelOf = (code: string) => SECTEUR_LABELS[code as SecteurKey] ?? KPI_SITE_LABELS[code as keyof typeof KPI_SITE_LABELS] ?? code

    if (!loaded) {
      return {
        loaded: false,
        companySectors: companySecteursForRegion(region),
        defaultCompanySector: defaultCompanySecteurForRegion(region),
        userSectors: userSecteursForRegion(region),
        driveRegions: driveRegionsForRegion(region),
        kpiSites: kpiSitesForRegion(region),
        labelOf: fallbackLabelOf,
        communesOf: () => [],
      }
    }

    const regionNode = nodes.find((n) => n.level === 'region')
    const sectors = nodes.filter((n) => n.level === 'sector')
    const byCode = new Map(sectors.map((s) => [s.code, s]))
    const isAnnemasse = region === 'annemasse'
    // Annemasse est mono-secteur côté utilisateurs, Drive et KPI : la région fait office de secteur.
    const userNodes = isAnnemasse && regionNode ? [regionNode] : sectors
    const siteKeys = isAnnemasse ? [ANNEMASSE_DRIVE_REGION] : sectors.map((s) => s.code)

    return {
      loaded: true,
      companySectors: sectors.map((s) => s.label),
      defaultCompanySector: sectors[0]?.label ?? defaultCompanySecteurForRegion(region),
      userSectors: userNodes.map((n) => n.label),
      driveRegions: siteKeys,
      kpiSites: siteKeys,
      labelOf: (code) =>
        byCode.get(code)?.label ?? (isAnnemasse && code === ANNEMASSE_DRIVE_REGION ? regionNode?.label : undefined) ?? fallbackLabelOf(code),
      communesOf: (sectorCode) => {
        const sector = byCode.get(sectorCode)
        return sector ? nodes.filter((n) => n.level === 'commune' && n.parentId === sector.id).map((n) => n.code) : []
      },
    }
  }, [loaded, nodes, region])
}
