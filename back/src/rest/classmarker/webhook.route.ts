import express, { Router, Request, Response } from 'express';
import { logger } from '../../external/logger/logger';
import { CandidateModel } from '../../db/mongo/schemas/candidate.schema';
import { addClient, removeClient, notifyCandidate } from './sse';
import { classmarkerWebhookGuard } from '../middleware/webhookSignature';
import { env } from '../../config/env';

export const router: Router = express.Router();

router.post(
    '/classmarker',
    ...classmarkerWebhookGuard(env.CLASSMARKER_WEBHOOK_SECRET),
    async (req: Request, res: Response) => {
        res.status(200).json({ received: true });

        try {
            const body = req.body ?? {};
            const { payload_status, result, test } = body;
            logger.info(
                {
                    payload_status,
                    cm_user_id: result?.cm_user_id,
                    percentage: result?.percentage,
                },
                'ClassMarker webhook received',
            );

            if (payload_status !== 'live') return;
            if (!result || typeof result.cm_user_id !== 'string') return;
            if (typeof result.percentage !== 'number') return;

            const candidateId = result.cm_user_id;
            const data = {
                percentage: result.percentage,
                points_scored: typeof result.points_scored === 'number' ? result.points_scored : undefined,
                points_available: typeof result.points_available === 'number' ? result.points_available : undefined,
                passed: typeof result.passed === 'boolean' ? result.passed : undefined,
                test_name: test?.test_name ?? undefined,
                completed_at:
                    typeof result.time_finished === 'number' ? new Date(result.time_finished * 1000) : new Date(),
                duration: typeof result.duration === 'string' ? result.duration : undefined,
            };

            const updated = await CandidateModel.findByIdAndUpdate(
                candidateId,
                { $set: { classmarker: data } },
                { returnDocument: 'after' },
            );
            if (!updated) {
                logger.warn({ candidateId }, 'ClassMarker webhook: candidate not found');
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
        } catch (err) {
            logger.error(err, 'ClassMarker webhook handling failed');
        }
    },
);

router.get('/classmarker/stream', (req: Request, res: Response) => {
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

router.get('/classmarker/result/:candidateId', async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    try {
        const doc = await CandidateModel.findById(candidateId).select('classmarker').lean();
        if (!doc) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json({ result: doc.classmarker ?? null });
    } catch (err) {
        logger.error(err, 'ClassMarker result fetch failed');
        res.status(500).json({ error: 'Internal error' });
    }
});
