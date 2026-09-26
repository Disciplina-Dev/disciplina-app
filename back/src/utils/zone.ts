import { ZONE_TO_COMMUNES, Zone } from '../services/mappers/abToOffer';
import { TrainingSite } from '../types/candidate.types';
import { Localisation } from '../types/matching.types';
import { CompanyRegion } from '../types/needsAnalysisNoSql.types';

export const TRAINING_SITE_TO_ZONE: Record<TrainingSite, Zone> = {
    [TrainingSite.NORD_SAINTE_MARIE]: 'NORD',
    [TrainingSite.OUEST_SAINT_PAUL]: 'OUEST',
    [TrainingSite.SUD_SAINT_PIERRE]: 'SUD',
};

export const ZONE_TO_TRAINING_SITE: Record<Zone, TrainingSite> = {
    NORD: TrainingSite.NORD_SAINTE_MARIE,
    OUEST: TrainingSite.OUEST_SAINT_PAUL,
    SUD: TrainingSite.SUD_SAINT_PIERRE,
};

export const COMMUNE_TO_ZONE = new Map<string, Zone>();
for (const [zone, communes] of Object.entries(ZONE_TO_COMMUNES)) {
    for (const commune of communes) {
        COMMUNE_TO_ZONE.set(commune, zone as Zone);
    }
}

export function zonesFromCommunes(communes: string[] | undefined): Set<Zone> {
    const set = new Set<Zone>();
    for (const c of communes ?? []) {
        const z = COMMUNE_TO_ZONE.get(c);
        if (z) set.add(z);
    }
    return set;
}

export function zonesFromTrainingSites(sites: (string | undefined)[] | undefined): Set<Zone> {
    const set = new Set<Zone>();
    for (const s of sites ?? []) {
        if (!s) continue;
        const z = TRAINING_SITE_TO_ZONE[s as TrainingSite];
        if (z) set.add(z);
    }
    return set;
}

/** Zones portées par une offre : secteur entreprise + communes de localisation. */
export function offerZones(offer: { company_infos?: { sector?: CompanyRegion | null }; localisation?: Localisation[] }): Set<Zone> {
    const set = new Set<Zone>();
    if (offer.company_infos?.sector) {
        const sector = offer.company_infos.sector as unknown as Zone;
        if (sector === 'NORD' || sector === 'OUEST' || sector === 'SUD') set.add(sector);
    }
    for (const z of zonesFromCommunes(offer.localisation)) set.add(z);
    return set;
}

/** Zones portées par un candidat : sites de formation + communes de mobilité. */
export function candidateZones(candidate: {
    training_site?: string | null;
    training_sites?: string[] | null;
    job_info?: { geographic_mobility?: string[] | null } | null;
}): Set<Zone> {
    const set = new Set<Zone>();
    for (const z of zonesFromTrainingSites(
        [candidate.training_site ?? undefined, ...(candidate.training_sites ?? [])],
    ))
        set.add(z);
    for (const z of zonesFromCommunes(candidate.job_info?.geographic_mobility ?? undefined)) set.add(z);
    return set;
}

export function communesForZones(zones: Set<Zone> | Zone[]): string[] {
    const list: string[] = [];
    for (const z of zones) {
        const communes = ZONE_TO_COMMUNES[z as Zone];
        if (communes) list.push(...communes);
    }
    return list;
}
