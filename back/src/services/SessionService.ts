import { FilizReferenceRepository } from '../repositories/mongo/FilizReferenceRepository';
import { FilizClassRef, FilizDegreeRef } from '../types/filizReference.types';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { FilizService } from '../external/filiz/filiz.service';
import { FilizSyncService, toClassRef } from './FilizSyncService';
import { env } from '../config/env';
import { CreateSessionInput, Session } from '../types/session.types';

// Une classe Filiz tient lieu de session : le diplôme devient la filière, les dates viennent de Filiz.
function classToSession(c: FilizClassRef, degrees: Map<string, FilizDegreeRef>): Session {
    return {
        _id: c._id,
        nom: c.name,
        filiere: degrees.get(c.degree_id)?.title ?? null,
        jour_cours: null,
        date_debut: c.start_date ?? c.synced_at,
        date_fin: c.end_date ?? c.synced_at,
        head_teacher: c.head_teacher ?? null,
        referent_teacher: c.referent_teacher ?? null,
        realization_address: c.realization_address ?? null,
        created_at: c.synced_at,
        updated_at: c.synced_at,
    };
}

// Filiz attend des dates MM/DD/YYYY ; le front envoie des dates ISO (YYYY-MM-DD).
function toFilizDate(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${m}/${d}/${y}`;
}

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

export class SessionService {
    private alternants = new AlternantRepository();
    private filizReference = new FilizReferenceRepository();
    private filizService = new FilizService();
    private filizSync = new FilizSyncService();

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

    async findDegrees(): Promise<{ id: string; title: string }[]> {
        return (await this.filizReference.findDegrees()).map((d) => ({ id: d._id, title: d.title }));
    }

    /**
     * Crée la promotion côté Filiz (POST /api/class), puis la relit pour alimenter le miroir local.
     * Les champs non envoyés (contrat, montants, enseignant, adresse) sont hérités de la formation par Filiz.
     */
    async create(input: CreateSessionInput): Promise<Session> {
        if (!env.FILIZ_CLASS_UPDATE_ENABLED) throw new Error('Modification des promotions Filiz désactivée');
        const className = input.nom.trim();
        if (!className) throw new Error('Le nom de la session est obligatoire');
        if (!isIsoDate(input.dateDebut)) throw new Error('La date de début est obligatoire');
        if (!isIsoDate(input.dateFin)) throw new Error('La date de fin est obligatoire');
        if (input.dateFin < input.dateDebut) throw new Error('La date de fin doit être postérieure à la date de début');
        if (!(await this.degreesById()).has(input.degreeId)) throw new Error('Formation introuvable');

        const generalEducationDuration = input.generalEducationDuration?.trim();
        const body: Record<string, unknown> = {
            degreeId: input.degreeId,
            className,
            startDate: toFilizDate(input.dateDebut),
            endDate: toFilizDate(input.dateFin),
            classStudyConfig: {
                subjectValidation: input.subjectValidation,
                ...(generalEducationDuration && { professionalizationContractConfig: { generalEducationDuration } }),
            },
        };
        if (input.headTeacher) body.headTeacher = input.headTeacher;
        if (input.referentTeacher) body.referentTeacher = input.referentTeacher;
        const address = Object.fromEntries(
            Object.entries(input.realizationAddress ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()),
        );
        if (Object.keys(address).length > 0) body.realizationAddress = address;

        const classId = await this.filizService.createClass(body);
        if (!classId) throw new Error('Filiz a refusé la création de la promotion');

        const created = await this.filizService.getClass(classId);
        if (!created) throw new Error('Promotion créée mais introuvable côté Filiz');
        await this.filizReference.upsertClasses([toClassRef({ ...created, classId, degreeId: input.degreeId })]);
        const session = await this.findById(classId);
        if (!session) throw new Error('Promotion créée mais introuvable en base');
        return session;
    }

    /** Rafraîchit formations + promotions depuis Filiz (sans les dossiers alternants). */
    async syncReference(): Promise<{ degrees: number; classes: number }> {
        const result = await this.filizSync.syncReference();
        // syncReference avale ses erreurs et renvoie 0/0 : on ne le présente pas comme un succès.
        if (result.degrees === 0) {
            throw new Error('Synchronisation Filiz impossible (Filiz injoignable ou aucune formation)');
        }
        return result;
    }
}
