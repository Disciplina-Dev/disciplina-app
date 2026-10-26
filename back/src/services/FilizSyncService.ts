import { FilizService } from '../external/filiz/filiz.service';
import { FilizClass, FilizDegree, FilizFolder } from '../external/filiz/type';
import { logger } from '../external/logger';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { FilizReferenceRepository } from '../repositories/mongo/FilizReferenceRepository';
import { Alternant, AlternantFiliz } from '../types/alternant.types';
import { FilizClassRef, FilizDegreeRef } from '../types/filizReference.types';

export interface FilizSyncResult {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    degrees: number;
    classes: number;
}

export function toDegreeRef(degree: FilizDegree): FilizDegreeRef {
    return {
        _id: degree.degreeId,
        degree_type: degree.degreeType ?? '',
        title: degree.exactDegreeTitle ?? '',
        prepared_title: degree.preparedTitleName ?? '',
        synced_at: new Date(),
    };
}

export function toClassRef(cls: FilizClass): FilizClassRef {
    return {
        _id: cls.classId,
        degree_id: cls.degreeId,
        name: cls.className ?? '',
        start_date: cls.startDate ?? null,
        end_date: cls.endDate ?? null,
        apprenticeship_contract: cls.classStudyConfig?.contractType?.apprenticeshipContract ?? false,
        professionalization_contract: cls.classStudyConfig?.contractType?.professionalizationContract ?? false,
        synced_at: new Date(),
    };
}

/**
 * Miroir local des folders Filiz dans `alternants.filiz`. Filiz n'expose ni filtre ni pagination :
 * on liste les ids, on récupère chaque folder, et on filtre ensuite en base. La sync n'écrit que
 * le sous-document `filiz` d'un alternant existant — la saisie péda n'est jamais écrasée.
 */
export class FilizSyncService {
    private filizService = new FilizService();
    private alternantRepository = new AlternantRepository();
    private candidateRepository = new CandidateRepository();
    private referenceRepository = new FilizReferenceRepository();

    // Référentiel formations / promotions : upsert sans suppression (les anciens alternants gardent leur libellé).
    // Un échec ici n'empêche pas la sync des folders.
    async syncReference(): Promise<{ degrees: number; classes: number }> {
        try {
            const degrees = await this.filizService.getDegreesInfos();
            if (!degrees) return { degrees: 0, classes: 0 };
            await this.referenceRepository.upsertDegrees(degrees.map(toDegreeRef));
            let classCount = 0;
            for (const degree of degrees) {
                const classes = await this.filizService.getClassInfos(degree.degreeId);
                if (!classes) continue;
                await this.referenceRepository.upsertClasses(classes.map(toClassRef));
                classCount += classes.length;
            }
            return { degrees: degrees.length, classes: classCount };
        } catch (err) {
            logger.error({ err }, 'FilizSyncService: reference sync failed');
            return { degrees: 0, classes: 0 };
        }
    }

    // `start_step` et `company_siret` ne viennent pas de Filiz : ils sont posés à la création du folder.
    private buildFiliz(folder: FilizFolder, classId: string, previous?: AlternantFiliz | null): AlternantFiliz {
        return {
            folder_id: folder.folderId,
            class_id: classId,
            degree_id: folder.degreeId ?? null,
            student_id: folder.studentId ?? null,
            step: folder.step,
            start_step: previous?.start_step ?? null,
            company_siret: previous?.company_siret ?? null,
            updated_at: folder.updateDate ? new Date(folder.updateDate) : null,
            synced_at: new Date(),
        };
    }

    // Retourne 'created' | 'updated', ou null si le folder ne peut pas être rattaché (étudiant introuvable chez Filiz).
    private async upsertFolder(folder: FilizFolder, classId: string): Promise<'created' | 'updated' | null> {
        const existing = await this.alternantRepository.findByFilizFolderId(folder.folderId);
        if (existing) {
            await this.alternantRepository.setFiliz(existing._id, this.buildFiliz(folder, classId, existing.filiz));
            return 'updated';
        }

        // Folder créé depuis le CRM : le candidat porte l'id, et son alternant éventuel n'a pas encore de miroir.
        const [candidate] = await this.candidateRepository.findByfilter({ filiz_folder_id: folder.folderId });
        if (candidate) {
            const unlinked = await this.alternantRepository.findUnlinkedByCandidateId(candidate._id);
            if (unlinked) {
                await this.alternantRepository.setFiliz(unlinked._id, this.buildFiliz(folder, classId));
                return 'updated';
            }
        }

        // Pas d'alternant : le CRM est postérieur à Filiz, beaucoup de folders n'ont jamais été candidats.
        const user = folder.studentId ? await this.filizService.getUser(folder.studentId) : null;
        if (!user) return null;
        const data: Omit<Alternant, '_id' | 'created_at' | 'updated_at'> = {
            first_name: user.firstName,
            last_name: user.lastName,
            // La session Disciplina n'a aucun lien avec la classe Filiz.
            session: '',
            session_id: null,
            email: user.mailAddress ?? null,
            candidate_id: candidate?._id ?? null,
            company: null,
            linked_alternant_ids: [],
            filiz: this.buildFiliz(folder, classId),
        };
        await this.alternantRepository.create(data);
        return 'created';
    }

    // Retourne null si Filiz est injoignable (la liste des ids n'a pas pu être lue).
    async syncAll(): Promise<FilizSyncResult | null> {
        const folderIds = await this.filizService.listFolderIds();
        if (!folderIds) return null;
        const reference = await this.syncReference();

        const { folders, failed: fetchFailed } = await this.filizService.getFolders(folderIds);
        const result: FilizSyncResult = {
            total: folderIds.length,
            created: 0,
            updated: 0,
            skipped: 0,
            failed: fetchFailed,
            ...reference,
        };

        for (const folder of folders) {
            if (!folder.classId) {
                result.skipped++;
                continue;
            }
            try {
                const outcome = await this.upsertFolder(folder, folder.classId);
                if (outcome) result[outcome]++;
                else result.failed++;
            } catch (err) {
                logger.error({ err, folderId: folder.folderId }, 'FilizSyncService: folder upsert failed');
                result.failed++;
            }
        }
        logger.info(result, 'FilizSyncService: sync done');
        return result;
    }
}
