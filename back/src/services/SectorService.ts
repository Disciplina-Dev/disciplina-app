import { Sector, SectorLevel, SectorRepository } from '../repositories/mysql/SectorRepository';
import { getRegion } from '../db/tenant';

interface SectorIndex {
    all: Sector[];
    byId: Map<number, Sector>;
    byCode: Map<string, Sector>;
    byLabel: Map<string, Sector>;
}

/**
 * Accès en lecture au référentiel région > secteur > commune. Le référentiel
 * change rarement : index en mémoire par tenant (une base par tenant), à
 * invalider via `invalidate()` après toute écriture sur `sectors`.
 */
export class SectorService {
    private repo = new SectorRepository();
    private cache = new Map<string, SectorIndex>();

    private async index(): Promise<SectorIndex> {
        const tenant = getRegion();
        const cached = this.cache.get(tenant);
        if (cached) return cached;

        const all = await this.repo.findAll();
        const index: SectorIndex = {
            all,
            byId: new Map(all.map((s) => [s.id, s])),
            // `code` n'est unique que par niveau : la commune ANNECY et le secteur ANNECY coexistent.
            byCode: new Map(all.map((s) => [`${s.level}:${s.code}`, s])),
            // Les libellés historiques (companies.sector, users.sectors) ne désignent que région ou secteur.
            byLabel: new Map(all.filter((s) => s.level !== 'commune').map((s) => [s.label, s])),
        };
        this.cache.set(tenant, index);
        return index;
    }

    invalidate(): void {
        this.cache.clear();
    }

    async list(level?: SectorLevel): Promise<Sector[]> {
        const { all } = await this.index();
        return level ? all.filter((s) => s.level === level) : all;
    }

    async getById(id: number): Promise<Sector | undefined> {
        return (await this.index()).byId.get(id);
    }

    async findByCode(level: SectorLevel, code: string): Promise<Sector | undefined> {
        return (await this.index()).byCode.get(`${level}:${code}`);
    }

    /** Résout un libellé historique (« Nord-Est », « Annemasse »…) vers son nœud région ou secteur. */
    async findByLabel(label: string): Promise<Sector | undefined> {
        return (await this.index()).byLabel.get(label);
    }

    /** Enfants directs d'un nœud. */
    async children(id: number): Promise<Sector[]> {
        return (await this.index()).all.filter((s) => s.parentId === id);
    }

    /** Communes d'un secteur (ou d'une région), à n'importe quelle profondeur. */
    async communesOf(id: number): Promise<Sector[]> {
        return (await this.repo.findSubtree(id)).filter((s) => s.level === 'commune');
    }

    /** Chaîne du nœud vers la région (nœud inclus). */
    async ancestorsOf(id: number): Promise<Sector[]> {
        return this.repo.findAncestors(id);
    }
}

export const sectorService = new SectorService();
