import { query } from '../../db/mysql/connection';
import { FilizStartStep } from '../../external/filiz/type';

export interface NewFilizFolder {
    folderId: string;
    candidateId: string;
    classId: string;
    startStep: FilizStartStep;
    companySiret: string | null;
}

export class FilizFolderRepository {
    // À la création, l'étape courante est l'étape de démarrage.
    async insert(folder: NewFilizFolder): Promise<void> {
        await query(
            `INSERT INTO filiz_folders (folder_id, candidate_id, class_id, start_step, step, company_siret)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                folder.folderId,
                folder.candidateId,
                folder.classId,
                folder.startStep,
                folder.startStep,
                folder.companySiret,
            ],
        );
    }
}
