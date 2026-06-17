import { Request, Response } from 'express';
import { verifyMatchUrl } from '../../external/crypto';
import { JobRepository } from '../../repositories/mongo/JobRepository';
import { MatchedCandidateStatus } from '../../types/job.types';
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
        const status = answer === 'oui' ? MatchedCandidateStatus.ACCEPTED : MatchedCandidateStatus.DECLINED;
        await jobRepository.setMatchedCandidateStatus(jobId, candidateId, status);
        logger.info({ jobId, candidateId, answer }, '[matching] response handled');
    } catch (err) {
        logger.error({ err }, '[matching] response error');
        return res.status(500).send(confirmationPage('Une erreur est survenue.', false));
    }

    const message =
        answer === 'oui'
            ? 'Merci ! Votre acceptation a bien été enregistrée.'
            : 'Merci pour votre retour. Votre refus a bien été enregistré.';

    res.send(confirmationPage(message, true));
}
