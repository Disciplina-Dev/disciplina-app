import { Request, Response } from 'express';
import { ExternalGuestRequest } from './guard';
import { MatchAccessService, AnswerInput, SessionAlreadyCompletedError } from '../../services/MatchAccessService';
import { MatchMailService } from '../../services/MatchMailService';
import { CandidateService } from '../../services/CandidateService';
import { CandidateRepository } from '../../repositories/mongo/CandidateRepository';
import { UserService } from '../../services/UserService';
import { NotificationService } from '../../services/NotificationService';
import { GoogleDriveService, extractDriveFileId } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';
import { MatchingCandidate } from '../../types/matching.types';
import { logger } from '../../external/logger';
import { GeocodageService } from '../../external/insee/geocodage.service';
import { assertConsent, hasConsent, ConsentType } from '../../services/consentGuard';

const matchAccessService = new MatchAccessService();
const matchMailService = new MatchMailService();
const candidateService = new CandidateService();
const candidateRepository = new CandidateRepository();
const userService = new UserService();
const notificationService = new NotificationService();
const geocodageService = new GeocodageService();

/** Vérifie que la session external concernée est bien une session de matching (reference 2). */
export function requireMatchingReference(req: ExternalGuestRequest, res: Response, next: () => void): void {
    if (req.guest?.referenceId !== 2) {
        res.status(403).json({ error: 'Session hors périmètre' });
        return;
    }
    next();
}

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

export async function getCandidates(req: ExternalGuestRequest, res: Response): Promise<void> {
    const candidates = await matchAccessService.getProposedCandidates(req.params.signature);
    const ids = candidates.map((c) => c.id);
    const consentDocs = ids.length ? await candidateRepository.findConsentmentsByIds(ids) : [];
    const consentById = new Map(consentDocs.map((doc) => [doc._id, doc]));

    const consenting = candidates.filter((c) => {
        const doc = consentById.get(c.id);
        if (!doc || !hasConsent(doc, [ConsentType.DATA_SHARING])) {
            logger.warn({ candidateId: c.id }, 'Candidate missing data_sharing consent, excluded from company view');
            return false;
        }
        return true;
    });

    res.json(consenting.map(proposedCandidateToPublic));
}

export async function getCv(req: ExternalGuestRequest, res: Response): Promise<void> {
    const context = await matchAccessService.getContext(req.params.signature);
    if (!context) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    const proposed = await matchAccessService.getProposedCandidates(req.params.signature);
    if (!proposed.some((c) => c.id === req.params.candidateId)) {
        res.status(403).json({ error: 'Candidat non autorisé' });
        return;
    }
    await streamCandidateCv(req.params.candidateId, context.rhEmail, res);
}

async function streamCandidateCv(candidateId: string, rhEmail: string | null, res: Response): Promise<void> {
    try {
        const candidate = await candidateService.findById(candidateId);
        if (candidate) {
            assertConsent(candidate, [ConsentType.DATA_SHARING], { mode: 'warn' }); // TODO flip to 'block' after backfill window
        }
        const fileId = candidate?.cv_link ? extractDriveFileId(candidate.cv_link) : null;
        const rh = rhEmail ? await userService.findByEmail(rhEmail) : null;
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

export async function submitAnswers(req: ExternalGuestRequest, res: Response): Promise<void> {
    const answers = (req.body?.answers ?? []) as AnswerInput[];
    if (!Array.isArray(answers) || answers.length === 0) {
        res.status(400).json({ error: 'Réponses requises' });
        return;
    }
    try {
        await matchAccessService.submitAnswers(req.params.signature, answers);
        await notifyCompletion(req.params.signature);
        res.json({ ok: true });
    } catch (err) {
        if (err instanceof SessionAlreadyCompletedError) {
            res.status(409).json({ error: err.message });
            return;
        }
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getCompletion(req: Request, res: Response): Promise<void> {
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

/** Notification RH quand une session de matching passe LOCKED (3 mauvais codes). */
export async function notifyLockedMatch(signature: string): Promise<void> {
    const context = await matchAccessService.getContext(signature);
    if (!context || context.referenceId !== 2) return;
    if (context.rhEmail && context.companyEmail) {
        await matchMailService.sendLockAlert(context.rhEmail, context.companyEmail);
    }
    const rh = context.rhEmail ? await userService.findByEmail(context.rhEmail) : null;
    if (rh) {
        await notificationService.create({
            userId: rh.id,
            type: 'match_locked',
            category: 'company',
            level: 'warning',
            title: 'Session entreprise bloquée',
            message: `${context.companyEmail ?? 'L’entreprise'} a échoué 3 fois. Créez une nouvelle session.`,
            link: `/rh/matching?offer=${context.offerUuid}`,
        });
    }
}

async function notifyCompletion(signature: string): Promise<void> {
    const context = await matchAccessService.getContext(signature);
    if (!context) return;
    const rh = context.rhEmail ? await userService.findByEmail(context.rhEmail) : null;
    if (!rh) return;
    await notificationService.create({
        userId: rh.id,
        type: 'match_completed',
        category: 'company',
        level: 'success',
        title: 'Réponses entreprise reçues',
        message: `${context.companyEmail ?? 'L’entreprise'} a répondu aux candidats proposés.`,
        link: `/rh/matching?offer=${context.offerUuid}`,
    });
}