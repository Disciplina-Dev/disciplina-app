import { FilizReferenceRepository } from '../repositories/mongo/FilizReferenceRepository';
import { FilizClassRef, FilizDegreeRef } from '../types/filizReference.types';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
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
}
