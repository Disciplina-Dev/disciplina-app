import express, { Router, Request, Response } from 'express';
import { logger } from '../../external/logger';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { classmarkerWebhookGuard } from '../middleware/webhookSignature';
import { env } from '../../config/env';
import { authenticateStaffStream } from '../middleware/sseAuth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { addClient, removeClient, notifyCandidate } from './sse';
import { PdfService } from '../../services/PdfService';
import { UserService } from '../../services/UserService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { JobRole } from '../../types/user.types';
import { Candidate } from '../../types/candidate.types';
import { driveParentFolderForTp } from '../../external/google/drive.folders';

const userService = new UserService();

/**
 * Génère le PDF des résultats et le dépose dans le dossier Drive du candidat.
 * Best-effort : toute erreur est journalisée sans interrompre le webhook.
 * Le webhook n'ayant pas de contexte utilisateur, on agit via les jetons Google
 * du créateur (owner) du dossier candidat — c'est lui qui possède déjà le dossier
 * Drive. Repli sur un RH connecté s'il n'a pas de compte Google lié.
 */
async function uploadResultPdf(candidate: Candidate): Promise<void> {
    const ownerId = candidate.owner?.user_id;
    const owner = ownerId ? await userService.findById(ownerId) : null;

    let driveUser = owner?.oauthToken ? owner : null;
    if (!driveUser) {
        driveUser = await userService.findFirstGoogleConnectedUser([JobRole.RH]);
        if (driveUser) {
            logger.warn(
                { candidateId: candidate._id, ownerId, fallbackUserId: driveUser.id },
                'ClassMarker PDF: owner sans compte Google, repli sur un autre RH connecté',
            );
        }
    }
    if (!driveUser) {
        logger.warn('ClassMarker PDF: no Google-connected user available, skipping upload');
        return;
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
            await driveParentFolderForTp(candidate.tp_type, candidate.training_site),
        );
        folderId = folder.id;
        update.drive_folder_id = folder.id;
        update.drive_folder_link = folder.webViewLink;
        logger.info({ candidateId: candidate._id, folderId }, 'ClassMarker PDF: created candidate Drive folder');
    }

    const pdfBuffer = await PdfService.generateClassMarkerPdf(candidate);
    const safeName = candidate.identity.full_name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
    // Nom unique par passage : test + horodatage. Évite l'écrasement / les
    // fichiers homonymes orphelins dans Drive, garde la trace de chaque test.
    const last = candidate.classmarker;
    const safeTest = (last?.test_name ?? '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
    const stamp = (last?.completed_at ? new Date(last.completed_at) : new Date())
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-');
    const fileName = `Resultats_test_${safeName || 'candidat'}${safeTest ? `_${safeTest}` : ''}_${stamp}.pdf`;

    const { webViewLink } = await driveService.uploadFile(fileName, 'application/pdf', pdfBuffer, folderId);

    update['classmarker.pdf_link'] = webViewLink;
    // Relie aussi le PDF à la dernière entrée d'historique (celle qu'on vient
    // de pousser) pour que chaque test garde son propre lien PDF.
    const historyLen = candidate.classmarker_history?.length ?? 0;
    if (historyLen > 0) {
        update[`classmarker_history.${historyLen - 1}.pdf_link`] = webViewLink;
    }
    await CandidateModel.findByIdAndUpdate(candidate._id, { $set: update });

    // Pousse le lien PDF aux clients SSE déjà connectés : le 1er notify (score)
    // part avant l'upload, donc sans pdf_link. Sans ce 2e notify, le bouton
    // "Voir le PDF" n'apparaît qu'après un rechargement de page.
    notifyCandidate(candidateId, { pdf_link: webViewLink });
    logger.info({ candidateId, webViewLink }, 'ClassMarker result PDF uploaded to Drive');
}

export const router: Router = express.Router();

router.post(
    '/classmarker',
    ...classmarkerWebhookGuard(env.CLASSMARKER_WEBHOOK_SECRET),
    async (req: Request, res: Response) => {
        // Serverless (Vercel): the lambda is frozen once the handler resolves.
        // Process fully — including the best-effort PDF upload — BEFORE sending
        // the response so the async work actually completes. Always answer 200
        // to avoid ClassMarker retry-storms.
        try {
            const body = req.body ?? {};
            const { payload_status, result, test, questions } = body;
            logger.info(
                {
                    payload_status,
                    cm_user_id: result?.cm_user_id,
                    percentage: result?.percentage,
                },
                'ClassMarker webhook received',
            );

            if (payload_status !== 'live') {
                logger.debug({ payload_status }, 'ClassMarker non-live payload, replying 200');
                res.status(200).json({ received: true });
                return;
            }
            if (!result || typeof result.cm_user_id !== 'string' || typeof result.percentage !== 'number') {
                res.status(200).json({ received: true });
                return;
            }

            const candidateId = result.cm_user_id;
            const data = {
                percentage: result.percentage,
                points_scored: typeof result.points_scored === 'number' ? result.points_scored : undefined,
                points_available: typeof result.points_available === 'number' ? result.points_available : undefined,
                // La moyenne du test = 50%. ClassMarker renvoie passed=true même à 35%
                // (passmark configuré à 0), donc on dérive le verdict du pourcentage.
                passed: typeof result.percentage === 'number' ? result.percentage >= 50 : undefined,
                test_name: test?.test_name ?? undefined,
                completed_at:
                    typeof result.time_finished === 'number' ? new Date(result.time_finished * 1000) : new Date(),
                duration: typeof result.duration === 'string' ? result.duration : undefined,
                questions: Array.isArray(questions) ? questions : undefined,
            };

            const updated = await CandidateModel.findByIdAndUpdate(
                candidateId,
                { $set: { classmarker: data }, $push: { classmarker_history: data } },
                { returnDocument: 'after' },
            );
            if (!updated) {
                logger.warn({ candidateId }, 'ClassMarker webhook: candidate not found');
                res.status(200).json({ received: true });
                return;
            }
            logger.info(
                { candidateId, percentage: data.percentage, passed: data.passed },
                'ClassMarker result saved to DB',
            );

            notifyCandidate(candidateId, {
                percentage: data.percentage,
                passed: data.passed,
                test_name: data.test_name ?? null,
                completed_at: typeof result.time_finished === 'number' ? result.time_finished : null,
                points_scored: data.points_scored,
                points_available: data.points_available,
                duration: data.duration ?? null,
            });

            try {
                await uploadResultPdf(updated.toObject() as Candidate);
            } catch (pdfErr) {
                logger.error({ err: pdfErr }, 'ClassMarker result PDF generation/upload failed');
            }

            res.status(200).json({ received: true });
        } catch (err) {
            logger.error({ err }, 'ClassMarker webhook handling failed');
            if (!res.headersSent) res.status(200).json({ received: true });
        }
    },
);

// Un staff observe le flux d'un candidat : candidateId reste un paramètre, le token est exigé.
router.get('/classmarker/stream', (req: AuthRequest, res: Response) => {
    if (!authenticateStaffStream(req, res)) return;
    const candidateId = typeof req.query.candidateId === 'string' ? req.query.candidateId : '';
    if (!candidateId) {
        res.status(400).end();
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    addClient(candidateId, res);
    const heartbeat = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch {
            /* ignore */
        }
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeClient(candidateId, res);
    });
});

router.get(
    '/classmarker/result/:candidateId',
    authenticate,
    requireRoles('AD', 'GESTION', 'RH', 'PEDA', 'COMMERCIAL'),
    async (req: AuthRequest, res: Response) => {
        const { candidateId } = req.params;
        try {
            const doc = await CandidateModel.findById(candidateId).select('classmarker classmarker_history').lean();
            if (!doc) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            res.json({ result: doc.classmarker ?? null, history: doc.classmarker_history ?? [] });
        } catch (err) {
            logger.error(err, 'ClassMarker result fetch failed');
            res.status(500).json({ error: 'Internal error' });
        }
    },
);
