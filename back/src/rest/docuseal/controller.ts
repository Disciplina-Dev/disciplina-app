import { Request, Response } from 'express';
import { processSignedAb } from '../../services/SignedAbProcessor';
import { logger } from '../../external/logger/logger';

/**
 * Receveur de webhook DocuSeal.
 * On agit uniquement sur la complétion de la submission (tous signataires OK).
 * Configurez l'URL `${APP}/api/webhooks/docuseal` et l'event `submission.completed`
 * dans le tableau de bord DocuSeal.
 */
export async function handleDocusealWebhook(req: Request, res: Response): Promise<void> {
    const eventType = req.body?.event_type;
    const data = req.body?.data ?? {};

    logger.info(`Received DocuSeal webhook: event=${eventType}`);

    if (eventType !== 'submission.completed') {
        res.status(200).json({ message: 'Event ignored' });
        return;
    }

    // submission.completed → data est l'objet submission.
    const submissionId = data.id ?? data.submission_id;
    if (!submissionId) {
        res.status(400).json({ error: 'Missing submission id' });
        return;
    }

    try {
        const handled = await processSignedAb(String(submissionId));
        res.status(200).json({ success: true, handled });
    } catch (error: any) {
        logger.error({ err: error }, 'Error processing DocuSeal webhook');
        res.status(500).json({ error: error.message });
    }
}
