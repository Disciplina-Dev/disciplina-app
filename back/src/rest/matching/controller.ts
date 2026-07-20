import { Request, Response } from 'express';
import { verifyMatchUrl } from '../../external/crypto';
import { OfferService } from '../../services/OfferService';
import { MatchedCandidateStatus } from '../../types/matching.types';
import { logger } from '../../external/logger';
import { confirmationPage } from '../shared/confirmationPage';

const offerService = new OfferService();

export async function handleMatchResponse(req: Request, res: Response) {
    const { offerId, candidateId, answer, sig, ts } = req.query as {
        offerId?: string;
        candidateId?: string;
        answer?: string;
        sig?: string;
        ts?: string;
    };

    if (!offerId || !candidateId || !answer || !sig || !ts || !['oui', 'non'].includes(answer)) {
        return res.status(400).send(confirmationPage('Lien invalide.', false));
    }

    if (!verifyMatchUrl(offerId, candidateId, answer, sig, Number(ts))) {
        return res.status(400).send(confirmationPage('Lien invalide ou expiré.', false));
    }

    try {
        const status = answer === 'oui' ? MatchedCandidateStatus.ACCEPTED : MatchedCandidateStatus.DECLINED;
        await offerService.updateMatchedCandidateStatus(offerId, candidateId, status);
        logger.info({ offerId, candidateId, answer }, '[matching] response handled');
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
