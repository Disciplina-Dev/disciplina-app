import { FilizReferenceRepository } from '../repositories/mongo/FilizReferenceRepository';
import { FilizClassRef, FilizDegreeRef } from '../types/filizReference.types';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { FilizService } from '../external/filiz/filiz.service';
import { toClassRef } from './FilizSyncService';
import { env } from '../config/env';
import { Session } from '../types/session.types';

// Une classe Filiz tient lieu de session : le diplôme devient la filière, les dates viennent de Filiz.
function classToSession(c: FilizClassRef, degrees: Map<string, FilizDegreeRef>): Session {
    return {
        _id: c._id,
        nom: c.name,
        filiere: degrees.get(c.degree_id)?.title ?? null,
        jour_cours: null,
        date_debut: c.start_date ?? c.synced_at,
        date_fin: c.end_date ?? c.synced_at,
        created_at: c.synced_at,
        updated_at: c.synced_at,
    };
}

export class SessionService {
    private alternants = new AlternantRepository();
    private filizReference = new FilizReferenceRepository();
    private filizService = new FilizService();

    private async degreesById(): Promise<Map<string, FilizDegreeRef>> {
        return new Map((await this.filizReference.findDegrees()).map((d) => [d._id, d]));
    }

    async findAll(search?: string): Promise<Session[]> {
        const [classes, degrees] = await Promise.all([this.filizReference.findClasses(search), this.degreesById()]);
        return classes.map((c) => classToSession(c, degrees));
    }

    async findById(id: string): Promise<Session | null> {
        const found = await this.filizReference.findClassById(id);
        return found ? classToSession(found, await this.degreesById()) : null;
    }

    async findAlternants(id: string) {
        return this.alternants.findByFilizClassId(id);
    }

    async countAlternants(sessionId: string): Promise<number> {
        return (await this.alternants.findByFilizClassId(sessionId)).length;
    }

    /**
     * Renomme la promotion côté Filiz (GET → remplace className → PATCH, le body complet étant obligatoire),
     * puis répercute le nom dans le miroir local pour que l'onglet le reflète sans attendre la sync.
     */
    async rename(id: string, nom: string): Promise<Session | null> {
        if (!env.FILIZ_CLASS_UPDATE_ENABLED) throw new Error('Modification des promotions Filiz désactivée');
        const className = nom.trim();
        if (!className) throw new Error('Le nom de la session est obligatoire');
        const local = await this.filizReference.findClassById(id);
        if (!local) return null;

        const current = await this.filizService.getClass(id);
        if (!current) throw new Error('Promotion introuvable côté Filiz');
        const body: Record<string, unknown> = { ...current, classId: id, className };
        delete body.degreeId;
        const updated = await this.filizService.updateClass(body);
        if (!updated) throw new Error('Filiz a refusé la modification de la promotion');

        await this.filizReference.upsertClasses([toClassRef({ ...current, degreeId: local.degree_id, className })]);
        return this.findById(id);
    }
}
