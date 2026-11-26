import express, { Router, Request, Response } from 'express';
import { logger } from '../../external/logger';
import { getModels } from '../../db/mongo/tenant';
import { getRegion, runForAllRegions, syncWithRegion } from '../../db/tenant';
import { classmarkerWebhookGuard } from '../middleware/webhookSignature';
import { env } from '../../config/env';
import { authenticateStaffStream } from '../middleware/sseAuth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/roleGuard';
import { addClient, removeClient } from './sse';
import { TestResultService } from '../../services/TestResultService';
import { sseKey } from '../shared/sseChannel';

export const router: Router = express.Router();

router.post(
    '/classmarker',
    ...classmarkerWebhookGuard(env.CLASSMARKER_WEBHOOK_SECRET),
    async (req: Request, res: Response) => {
        // Serverless (Vercel): the lambda is frozen once the handler resolves.
        // Process fully — including the best-effort PDF upload — BEFORE sending
        // the response so the async work actually completes. Always answer 200
        // to avoid ClassMarker retry-storms.
        // Le webhook n'a pas de JWT : on itère les deux bases régionales pour
        // trouver le candidat (l'ObjectId n'existe que dans UNE des deux), puis
        // on traite dans la région trouvée sous ALS — le push SSE et l'upload
        // Drive repartent alors vers la bonne base et la bonne clé de canal.
        let updated: any = null;
        let handled = false;
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
                source: 'classmarker' as const,
            };

            await runForAllRegions(async () => {
                if (handled) return;
                try {
                    const candidate = await TestResultService.saveTestResult(candidateId, data);
                    if (!candidate) return;
                    handled = true;
                    updated = candidate;
                } catch (err) {
                    if (handled) throw err;
                    logger.error({ err, region: getRegion() }, 'ClassMarker webhook handling failed');
                }
            });

            if (!updated) {
                logger.warn({ candidateId }, 'ClassMarker webhook: candidate not found');
                res.status(200).json({ received: true });
                return;
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
    const staff = authenticateStaffStream(req, res);
    if (!staff) return;
    const candidateId = typeof req.query.candidateId === 'string' ? req.query.candidateId : '';
    if (!candidateId) {
        res.status(400).end();
        return;
    }

    syncWithRegion(staff.region, () => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        res.write(': connected\n\n');

        addClient(sseKey(staff.region, candidateId), res);
        const heartbeat = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch {
                /* ignore */
            }
        }, 30000);

        req.on('close', () => {
            clearInterval(heartbeat);
            removeClient(sseKey(staff.region, candidateId), res);
        });
    });
});

router.get(
    '/classmarker/result/:candidateId',
    authenticate,
    requireRoles('AD', 'GESTION', 'RH', 'PEDA', 'COMMERCIAL'),
    async (req: AuthRequest, res: Response) => {
        const { candidateId } = req.params;
        try {
            const doc = await getModels().Candidate.findById(candidateId).select('classmarker classmarker_history').lean();
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
