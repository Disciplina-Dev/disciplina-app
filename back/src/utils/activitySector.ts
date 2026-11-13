import { Sector } from '../types/matching.types';

/**
 * Secteurs d'activité (métier) du matching : clé canonique = valeur de l'enum
 * `Sector`, plus les libellés affichés et les variantes historiques.
 *
 * Le même secteur peut être enregistré sous deux formes selon l'écran et
 * l'ancienneté de la fiche : code enum côté formulaire candidat récent
 * (`desired_sectors`) ou libellé côté AB / offre (`company_infos.activities`,
 * `companySectors`). Le matching doit les rapprocher, sinon un candidat ayant
 * coché « Restauration » ne matcherait pas une offre « RESTAURATION ».
 *
 * Les libellés sont repris de `front/disciplina-front/src/data/sectors.ts` :
 * une évolution du référentiel doit être répercutée des deux côtés.
 */
const SECTOR_ALIASES: Record<Sector, readonly string[]> = {
    [Sector.BOULANGERIE]: ['Boulangerie'],
    [Sector.RESTAURATION]: ['Restauration'],
    [Sector.STATION]: ['Station de service'],
    [Sector.PAP]: ['Prêt à porter', 'Prêt-à-porter', 'Mode / Textile', 'Mode/Textile'],
    [Sector.LIBRE_SERVICE]: ['Libre service / Alimentation', 'Libre service/Alimentation'],
    [Sector.TELEPHONIE]: ['Téléphonie / Audio / Vidéo', 'Téléphonie/Audio/Vidéo'],
    [Sector.AUTO]: ['Automobile'],
    [Sector.COMMERCIAL]: ['Commerce / Vente', 'Commerce', 'Vente'],
    [Sector.BIJOUX]: ['Bijouterie', 'Bijoux', 'Mode/Textile (Bijoux/Cosmétique)'],
    [Sector.COSMETIQUE]: ['Cosmétique / Parfumerie', 'Cosmétique', 'Parfumerie', 'Mode/Textile (Bijoux/Cosmétique)'],
    [Sector.IMMOBILIER]: ['Immobilier'],
    [Sector.ASSURANCE]: ['Assurance'],
    [Sector.ANIMAUX]: ['Animaux / Animalerie', 'Animaux', 'Animalerie'],
    [Sector.SPORT]: ['Sport'],
    [Sector.ENFANT]: ['Enfant / Puériculture', 'Enfant', 'Puériculture'],
    [Sector.PHARMACIE]: ['Pharmacie'],
    [Sector.BAZAR]: ['Bazar / Maison / Déco', 'Bazar', 'Maison', 'Déco'],
    [Sector.BTP]: ['BTP'],
    [Sector.ASSOCIATION]: ['Association'],
    [Sector.MEDICAL]: ['Médical'],
    [Sector.ENERGIE]: ['Energie'],
    [Sector.IMPORT_EXPORT]: ['Import / Export', 'Import/Export'],
    [Sector.SOCIAL]: ['Social'],
    [Sector.NONE]: ['Aucun', 'None'],
};

/** Minuscules, sans accents ni ponctuation : « Commerce / Vente » ≡ « commerce-vente ». */
function normalizeSectorValue(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const ALIAS_TO_KEYS = new Map<string, Set<Sector>>();
for (const [key, aliases] of Object.entries(SECTOR_ALIASES) as [Sector, readonly string[]][]) {
    for (const alias of [key, ...aliases]) {
        const normalized = normalizeSectorValue(alias);
        const keys = ALIAS_TO_KEYS.get(normalized) ?? new Set<Sector>();
        keys.add(key);
        ALIAS_TO_KEYS.set(normalized, keys);
    }
}

/** Convertit une valeur libre (code ou libellé) en secteurs canoniques connus. */
export function canonicalActivitySectors(value: string): Sector[] {
    return [...(ALIAS_TO_KEYS.get(normalizeSectorValue(value)) ?? [])];
}

export interface ActivitySectorFilter {
    /** Secteurs du référentiel reconnus dans les valeurs d'entrée (dédupliqués). */
    keys: Sector[];
    /**
     * Toutes les formes stockables pour ces secteurs (code + libellés/alias).
     * Sert au `$in` Mongo sur `desired_sectors`.
     */
    mongoValues: string[];
}

/**
 * Prépare le rapprochement des secteurs d'une offre avec les secteurs souhaités
 * d'un candidat. `keys` vide = aucun secteur du référentiel (valeurs libres
 * uniquement) : le critère secteur ne peut pas être appliqué.
 */
export function activitySectorFilter(values?: readonly string[] | null): ActivitySectorFilter {
    const keys = new Set<Sector>();
    for (const value of values ?? []) {
        for (const key of canonicalActivitySectors(value)) keys.add(key);
    }

    const mongoValues = new Set<string>();
    for (const key of keys) {
        mongoValues.add(key);
        for (const alias of SECTOR_ALIASES[key]) mongoValues.add(alias);
    }

    return { keys: [...keys], mongoValues: [...mongoValues] };
}

/**
 * Vrai si le candidat a coché au moins un des secteurs de l'offre. Sans secteur
 * d'offre référencé, le critère est neutre (on ne peut pas conclure).
 */
export function candidateWantsOfferSector(
    desiredSectors: readonly string[] | null | undefined,
    offerSectorKeys: readonly Sector[],
): boolean {
    if (offerSectorKeys.length === 0) return true;
    const wanted = new Set<Sector>();
    for (const value of desiredSectors ?? []) {
        for (const key of canonicalActivitySectors(value)) wanted.add(key);
    }
    return offerSectorKeys.some((key) => wanted.has(key));
}
