import { Request, Response } from 'express';
import { verifyMatchUrl } from '../../external/crypto';
import { JobRepository } from '../../repositories/mongo/JobRepository';
import { logger } from '../../external/logger';
import { confirmationPage } from '../shared/confirmationPage';

const jobRepository = new JobRepository();

export async function handleMatchResponse(req: Request, res: Response) {
    const { jobId, candidateId, answer, sig } = req.query as {
        jobId?: string;
        candidateId?: string;
        answer?: string;
        sig?: string;
    };

    if (!jobId || !candidateId || !answer || !sig || !['oui', 'non'].includes(answer)) {
        return res.status(400).send(confirmationPage('Lien invalide.', false));
    }

    if (!verifyMatchUrl(jobId, candidateId, answer, sig)) {
        return res.status(400).send(confirmationPage('Lien invalide ou expiré.', false));
    }

    try {
        if (answer === 'non') {
            await jobRepository.removeMatchedCandidate(jobId, candidateId);
        }
        logger.info({ jobId, candidateId, answer }, '[matching] response handled');
    } catch (err) {
        logger.error({ err }, '[matching] response error');
        return res.status(500).send(confirmationPage('Une erreur est survenue.', false));
    }

    const message =
        answer === 'non'
            ? 'Merci pour votre retour. Votre candidature a été retirée de cette offre.'
            : 'Merci ! Votre candidature reste active pour cette offre.';

    res.send(confirmationPage(message, true));
}
