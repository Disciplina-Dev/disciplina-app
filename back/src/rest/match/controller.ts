import { Request, Response } from 'express';
import { MatchGuestRequest } from './guard';
import { MatchLinkService, AnswerInput } from '../../services/MatchLinkService';
import { MatchMailService } from '../../services/MatchMailService';
import { CandidateService } from '../../services/CandidateService';
import { UserService } from '../../services/UserService';
import { NotificationService } from '../../services/NotificationService';
import { GoogleDriveService, extractDriveFileId } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';
import { MatchingCandidate } from '../../types/matching.types';
import { logger } from '../../external/logger';
import { GeocodageService } from '../../external/insee/geocodage.service';
import { buildMatchingLink } from '../../utils/matchingLink';

const matchLinkService = new MatchLinkService();
const matchMailService = new MatchMailService();
const candidateService = new CandidateService();
const userService = new UserService();
const notificationService = new NotificationService();
const geocodageService = new GeocodageService();

function proposedCandidateToPublic(candidate: MatchingCandidate): object {
    return {
        id: candidate.id,
        fullName: candidate.full_name,
        age: candidate.age,
        sex: candidate.sex,
        city: candidate.city,
        description: candidate.description ?? '',
        status: candidate.status ?? null,
    };
}

export async function inspect(req: Request, res: Response): Promise<void> {
    const result = await matchLinkService.inspect(req.params.signature);
    res.json(result);
}

export async function regenerate(req: Request, res: Response): Promise<void> {
    const credentials = await matchLinkService.regenerate(req.params.signature);
    if (!credentials) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    await matchMailService.sendInvitation(credentials);
    res.json({ ok: true });
}

export async function authenticate(req: Request, res: Response): Promise<void> {
    const { code, identifier } = req.body as { code?: string; identifier?: string };
    if (!code || !identifier) {
        res.status(400).json({ error: 'Code et identifiant requis' });
        return;
    }
    const result = await matchLinkService.authenticate(req.params.signature, code, identifier);
    if (result.ok) {
        res.json({ token: result.token });
        return;
    }
    if (result.reason === 'locked') await notifyLock(req.params.signature);
    res.status(401).json({ reason: result.reason, remaining: result.remaining });
}

async function notifyLock(signature: string): Promise<void> {
    const context = await matchLinkService.getContext(signature);
    if (!context) return;
    await matchMailService.sendLockAlert(context.rhEmail, context.companyEmail);
    const rh = await userService.findByEmail(context.rhEmail);
    if (rh) {
        await notificationService.create({
            userId: rh.id,
            type: 'match_locked',
            category: 'company',
            level: 'warning',
            title: 'Session entreprise bloquée',
            message: `${context.companyEmail} a échoué 3 fois. Créez une nouvelle session.`,
            link: buildMatchingLink(context.offerUuid, context.needsAnalysisId),
        });
    }
}

export async function getCandidates(req: MatchGuestRequest, res: Response): Promise<void> {
    const candidates = await matchLinkService.getProposedCandidates(req.params.signature);
    res.json(candidates.map(proposedCandidateToPublic));
}

export async function getCv(req: MatchGuestRequest, res: Response): Promise<void> {
    const context = await matchLinkService.getContext(req.params.signature);
    if (!context) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    const proposed = await matchLinkService.getProposedCandidates(req.params.signature);
    if (!proposed.some((c) => c.id === req.params.candidateId)) {
        res.status(403).json({ error: 'Candidat non autorisé' });
        return;
    }
    await streamCandidateCv(req.params.candidateId, context.rhEmail, res);
}

async function streamCandidateCv(candidateId: string, rhEmail: string, res: Response): Promise<void> {
    try {
        const candidate = await candidateService.findById(candidateId);
        const fileId = candidate?.cv_link ? extractDriveFileId(candidate.cv_link) : null;
        const rh = await userService.findByEmail(rhEmail);
        if (!fileId || !rh?.oauthToken) {
            res.status(404).json({ error: 'CV introuvable' });
            return;
        }
        const creds: GoogleTokens = { access_token: rh.oauthToken, refresh_token: rh.refreshToken ?? undefined };
        const persist = (refreshed: GoogleTokens) =>
            userService.updateGoogleTokens(rh.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
        const { buffer, mimeType } = await GoogleDriveService.fromTokens(creds, persist).downloadFile(fileId);
        res.json({
            filename: `CV_${candidate!.identity.full_name}.pdf`,
            contentType: mimeType,
            content: buffer.toString('base64'),
        });
    } catch (err) {
        logger.error({ err }, '[match] CV proxy failed');
        res.status(500).json({ error: 'Internal error' });
    }
}

export async function submitAnswers(req: MatchGuestRequest, res: Response): Promise<void> {
    const answers = (req.body?.answers ?? []) as AnswerInput[];
    if (!Array.isArray(answers) || answers.length === 0) {
        res.status(400).json({ error: 'Réponses requises' });
        return;
    }
    try {
        await matchLinkService.submitAnswers(req.params.signature, answers);
        await notifyCompletion(req.params.signature);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getCompletion(req: MatchGuestRequest, res: Response): Promise<void> {
    const { input } = req.query;
    if (typeof input !== 'string' || !input.trim()) {
        res.status(400).json({ status: 'KO', results: [] });
        return;
    }
    try {
        const results = await geocodageService.search(input.trim());
        if (results === null) {
            res.json({ status: 'KO', results: [] });
            return;
        }
        res.json({ status: 'OK', results });
    } catch (error: any) {
        logger.error({ err: error }, 'Match: échec autocomplétion adresse');
        res.json({ status: 'KO', results: [] });
    }
}

async function notifyCompletion(signature: string): Promise<void> {
    const context = await matchLinkService.getContext(signature);
    if (!context) return;
    const rh = await userService.findByEmail(context.rhEmail);
    if (!rh) return;
    await notificationService.create({
        userId: rh.id,
        type: 'match_completed',
        category: 'company',
        level: 'success',
        title: 'Réponses entreprise reçues',
        message: `${context.companyEmail} a répondu aux candidats proposés.`,
        link: `/rh/matching?offer=${context.offerUuid}`,
    });
}
