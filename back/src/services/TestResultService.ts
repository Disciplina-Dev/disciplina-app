import { logger } from '../external/logger';
import { getModels } from '../db/mongo/tenant';
import { getRegion } from '../db/tenant';
import { notifyCandidate } from '../rest/classmarker/sse';
import { PdfService } from './PdfService';
import { UserService } from './UserService';
import { GoogleDriveService } from '../external/google/drive.service';
import { driveParentFolderForTp } from '../external/google/drive.folders';
import { JobRole } from '../types/user.types';
import { Candidate, ClassMarkerResult } from '../types/candidate.types';

const userService = new UserService();

/**
 * Point d'entrée unique d'un résultat de test, qu'il vienne du webhook ClassMarker
 * ou d'un questionnaire interne : même format (`classmarker` + `classmarker_history`),
 * donc fiche candidat, gate, PDF, Drive, SSE et MCP restent inchangés.
 * Doit tourner sous la région (ALS) du candidat.
 */
export class TestResultService {
    /**
     * Enregistre le résultat, pousse le score en SSE puis dépose le PDF sur Drive
     * (best-effort). Renvoie le candidat mis à jour, ou null s'il n'existe pas dans
     * la région courante.
     */
    static async saveTestResult(
        candidateId: string,
        data: ClassMarkerResult,
        options: { backgroundPdf?: boolean } = {},
    ): Promise<Candidate | null> {
        const candidate = await getModels().Candidate.findByIdAndUpdate(
            candidateId,
            { $set: { classmarker: data }, $push: { classmarker_history: data } },
            { returnDocument: 'after' },
        );
        if (!candidate) return null;
        logger.info(
            { candidateId, region: getRegion(), percentage: data.percentage, passed: data.passed, source: data.source },
            'Test result saved to DB',
        );

        notifyCandidate(candidateId, {
            percentage: data.percentage,
            passed: data.passed,
            test_name: data.test_name ?? null,
            completed_at: data.completed_at ? Math.floor(new Date(data.completed_at).getTime() / 1000) : null,
            points_scored: data.points_scored,
            points_available: data.points_available,
            duration: data.duration ?? null,
        });

        const saved = candidate.toObject() as Candidate;
        const upload = async (): Promise<void> => {
            try {
                await TestResultService.uploadResultPdf(saved, data.attempt_id);
            } catch (pdfErr) {
                logger.error({ err: pdfErr, candidateId }, 'Test result PDF generation/upload failed');
            }
        };
        // Page candidat : l'upload Drive (plusieurs secondes) ne doit pas retarder l'écran
        // de fin. Le webhook, lui, attend (serverless : la lambda gèle après la réponse).
        if (options.backgroundPdf) void upload();
        else await upload();
        return saved;
    }

    /**
     * Génère le PDF du dernier résultat et le dépose dans le dossier Drive du candidat.
     * Sans contexte utilisateur (webhook / page publique), on agit via les jetons
     * Google du créateur (owner) du dossier candidat, repli sur un RH connecté.
     * Lève en cas d'échec Drive ; renvoie false si aucun compte Google n'est disponible.
     */
    /**
     * Nom unique par passage : test + horodatage. Évite l'écrasement / les
     * fichiers homonymes orphelins dans Drive, garde la trace de chaque test.
     */
    static resultPdfFileName(fullName: string, result: ClassMarkerResult): string {
        const safe = (v: string) => v.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
        const safeName = safe(fullName);
        const safeTest = safe(result.test_name ?? '');
        const stamp = (result.completed_at ? new Date(result.completed_at) : new Date())
            .toISOString()
            .slice(0, 19)
            .replace(/[:T]/g, '-');
        return `Resultats_test_${safeName || 'candidat'}${safeTest ? `_${safeTest}` : ''}_${stamp}.pdf`;
    }

    static async uploadResultPdf(candidate: Candidate, attemptId?: string): Promise<boolean> {
        // Renvoi d'un passage précis (questionnaire interne) : on cible son entrée
        // d'historique ; sinon la dernière (cas du webhook, juste après le $push).
        const history = candidate.classmarker_history ?? [];
        const targetIndex = attemptId ? history.findIndex((h) => h.attempt_id === attemptId) : history.length - 1;
        const target = targetIndex >= 0 ? history[targetIndex] : candidate.classmarker;
        if (!target) return false;

        const ownerId = candidate.owner?.user_id;
        const owner = ownerId ? await userService.findById(ownerId) : null;

        let driveUser = owner?.oauthToken ? owner : null;
        if (!driveUser) {
            driveUser = await userService.findFirstGoogleConnectedUser([JobRole.RH]);
            if (driveUser) {
                logger.warn(
                    { candidateId: candidate._id, ownerId, fallbackUserId: driveUser.id },
                    'Test PDF: owner sans compte Google, repli sur un autre RH connecté',
                );
            }
        }
        if (!driveUser) {
            logger.warn(
                { candidateId: candidate._id },
                'Test PDF: no Google-connected user available, skipping upload',
            );
            return false;
        }

        const driveService = GoogleDriveService.fromTokens(
            { access_token: driveUser.oauthToken!, refresh_token: driveUser.refreshToken ?? undefined },
            userService.googleTokenPersister(driveUser.id),
        );

        // Crée le dossier Drive du candidat s'il n'existe pas encore (même schéma de
        // nommage que les autres flux : "<Nom> - <8 premiers caractères de l'id>").
        const candidateId = String(candidate._id);
        const update: Record<string, unknown> = {};
        let folderId = candidate.drive_folder_id;
        if (!folderId) {
            const folderName = `${candidate.identity.full_name} - ${candidateId.substring(0, 8)}`;
            const folder = await driveService.createFolder(
                folderName,
                await driveParentFolderForTp(candidate.tp_types?.[0], candidate.training_site),
            );
            folderId = folder.id;
            update.drive_folder_id = folder.id;
            update.drive_folder_link = folder.webViewLink;
            logger.info({ candidateId: candidate._id, folderId }, 'Test PDF: created candidate Drive folder');
        }

        const pdfBuffer = await PdfService.generateClassMarkerPdf({ ...candidate, classmarker: target });
        const fileName = TestResultService.resultPdfFileName(candidate.identity.full_name, target);

        const { webViewLink } = await driveService.uploadFile(fileName, 'application/pdf', pdfBuffer, folderId);

        // Le résultat courant n'est mis à jour que s'il s'agit du passage ciblé.
        const isCurrent = !attemptId || candidate.classmarker?.attempt_id === attemptId;
        if (isCurrent) update['classmarker.pdf_link'] = webViewLink;
        // Relie aussi le PDF à son entrée d'historique pour que chaque test garde son propre lien.
        if (targetIndex >= 0) {
            update[`classmarker_history.${targetIndex}.pdf_link`] = webViewLink;
        }
        await getModels().Candidate.findByIdAndUpdate(candidate._id, { $set: update });

        // Pousse le lien PDF aux clients SSE déjà connectés : le 1er notify (score)
        // part avant l'upload, donc sans pdf_link. Sans ce 2e notify, le bouton
        // "Voir le PDF" n'apparaît qu'après un rechargement de page.
        if (isCurrent) notifyCandidate(candidateId, { pdf_link: webViewLink });
        logger.info({ candidateId }, 'Test result PDF uploaded to Drive');
        return true;
    }
}
