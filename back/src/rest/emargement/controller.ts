import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import {
    ClientMeta,
    AssiduiteFilter,
    EmargementExportFilter,
    EmargementService,
} from '../../services/EmargementService';
import { EmargementExportService } from '../../services/EmargementExportService';
import { parsePdfTheme } from '../../services/emargementPdfThemes';
import {
    SEANCE_SITES,
    SEANCE_VALIDATION_STATUSES,
    SeanceSite,
    SeanceValidationStatus,
} from '../../types/emargement.types';
import { isIsoDate } from '../../utils/zonedTime';

const service = new EmargementService();
const renderer = new EmargementExportService();

/** Erreur métier (`status` posé par httpError) → 4xx + code ; le reste → 500 journalisé. */
export function sendError(res: Response, error: unknown, context: string): void {
    const err = error as Error & { status?: number; code?: string };
    if (typeof err.status === 'number' && err.status < 500) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
    }
    logger.error({ err: error }, context);
    res.status(typeof err.status === 'number' ? err.status : 500).json({
        error: typeof err.status === 'number' ? err.message : 'Erreur interne',
    });
}

/** IP et appareil lus côté serveur : le corps de requête ne fait jamais foi. */
export function clientMeta(req: Request): ClientMeta {
    const userAgent = req.headers['user-agent'];
    return {
        ip: req.ip ? req.ip.slice(0, 64) : null,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
    };
}

function queryString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Booléen de query string : `1`, `true`, `yes` (insensible à la casse). */
function queryFlag(value: unknown): boolean {
    const raw = queryString(value)?.toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
}

// ── Côté Peda ────────────────────────────────────────────────────────────────

export async function list(req: AuthRequest, res: Response): Promise<void> {
    try {
        const from = queryString(req.query.from);
        const to = queryString(req.query.to);
        const sessionId = queryString(req.query.sessionId);
        const validation = queryString(req.query.validation);
        const seances = await service.list({
            sessionId,
            from: from && isIsoDate(from) ? from : undefined,
            to: to && isIsoDate(to) ? to : undefined,
            validation:
                validation && (SEANCE_VALIDATION_STATUSES as readonly string[]).includes(validation)
                    ? (validation as SeanceValidationStatus)
                    : undefined,
            missing: queryFlag(req.query.missing),
        });
        res.json({ seances });
    } catch (error) {
        sendError(res, error, 'Emargement list failed');
    }
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.get(String(req.params.id)) });
    } catch (error) {
        sendError(res, error, 'Emargement fetch failed');
    }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json(await service.create(req.body, req.user?.id));
    } catch (error) {
        sendError(res, error, 'Emargement create failed');
    }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.update(String(req.params.id), req.body) });
    } catch (error) {
        sendError(res, error, 'Emargement update failed');
    }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(String(req.params.id));
        res.json({ deleted: true });
    } catch (error) {
        sendError(res, error, 'Emargement delete failed');
    }
}

export async function resend(req: AuthRequest, res: Response): Promise<void> {
    try {
        const rotate = req.body?.rotate === true;
        res.json(await service.resendInvite(String(req.params.id), rotate, req.user?.id));
    } catch (error) {
        sendError(res, error, 'Emargement resend failed');
    }
}

/** Validation de régularisation : le Peda débloque une feuille que le formateur ne signera pas. */
export async function validate(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({
            seance: await service.validate(String(req.params.id), req.body, req.user?.id, clientMeta(req)),
        });
    } catch (error) {
        sendError(res, error, 'Emargement validation failed');
    }
}

// ── Exports (§8) ─────────────────────────────────────────────────────────────

/** Nom de fichier lisible, sans accents ni espaces (le vrai nom est en UTF-8 dans l'en-tête). */
function fileSlug(value: string | null | undefined): string {
    return (
        (value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .slice(0, 60) || 'emargement'
    );
}

function sendFile(res: Response, body: Buffer, contentType: string, fileName: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
}

/** Filtres communs aux exports : séance, session, bornes de dates (invalidées si mal formées). */
function exportFilter(req: AuthRequest): EmargementExportFilter {
    const seanceId = queryString(req.query.seanceId);
    const sessionId = queryString(req.query.sessionId);
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    return {
        seanceId,
        sessionId,
        from: from && isIsoDate(from) ? from : undefined,
        to: to && isIsoDate(to) ? to : undefined,
        includeArchived: queryFlag(req.query.includeArchived),
    };
}

/** Période d'assiduité : bornes de dates + session / site optionnels. */
function assiduiteFilter(req: AuthRequest): AssiduiteFilter {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const sessionId = queryString(req.query.sessionId);
    const site = queryString(req.query.site);
    return {
        from: from && isIsoDate(from) ? from : undefined,
        to: to && isIsoDate(to) ? to : undefined,
        sessionId,
        site: site && (SEANCE_SITES as readonly string[]).includes(site) ? (site as SeanceSite) : undefined,
    };
}

/** `?format=csv` (défaut) ou `?format=xlsx`. */
function exportFormat(value: unknown): 'csv' | 'xlsx' {
    return value === 'xlsx' ? 'xlsx' : 'csv';
}

/** Feuille d'émargement d'une séance en PDF (charte Disciplina / Région / FSE+). */
export async function seancePdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        const seance = await service.get(String(req.params.id));
        const pdf = await renderer.seancePdf(seance, parsePdfTheme(req.query.theme));
        sendFile(res, pdf, 'application/pdf', `emargement-${seance.date}-${fileSlug(seance.sessionNom)}.pdf`);
    } catch (error) {
        sendError(res, error, 'Emargement seance PDF export failed');
    }
}

/** Présences et heures (une ligne par alternant × demi-journée, plus une synthèse). */
export async function exportAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
        const data = await service.exportAttendance(exportFilter(req));
        const name = `presences-${data.from ?? 'debut'}-${data.to ?? 'fin'}`;
        if (exportFormat(req.query.format) === 'xlsx') {
            const buffer = await renderer.attendanceXlsx(data);
            sendFile(res, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${name}.xlsx`);
            return;
        }
        const csv = Buffer.from(renderer.attendanceCsv(data), 'utf8');
        sendFile(res, csv, 'text/csv; charset=utf-8', `${name}.csv`);
    } catch (error) {
        sendError(res, error, 'Emargement attendance export failed');
    }
}

/** Journal d'audit (changements de statut, signatures, validations) en CSV. */
export async function exportHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
        const data = await service.exportHistory(exportFilter(req));
        const csv = Buffer.from(renderer.historyCsv(data), 'utf8');
        sendFile(
            res,
            csv,
            'text/csv; charset=utf-8',
            `journal-emargement-${data.from ?? 'debut'}-${data.to ?? 'fin'}.csv`,
        );
    } catch (error) {
        sendError(res, error, 'Emargement history export failed');
    }
}

/** Attestation d'assiduité d'un alternant sur une période. */
export async function exportAttestation(req: AuthRequest, res: Response): Promise<void> {
    try {
        const from = queryString(req.query.from);
        const to = queryString(req.query.to);
        const attestation = await service.attestation(String(req.params.alternantId), {
            from: from && isIsoDate(from) ? from : undefined,
            to: to && isIsoDate(to) ? to : undefined,
        });
        const pdf = await renderer.attestationPdf(attestation, parsePdfTheme(req.query.theme));
        sendFile(
            res,
            pdf,
            'application/pdf',
            `attestation-${fileSlug(`${attestation.firstName} ${attestation.lastName}`)}-${attestation.from ?? 'debut'}-${attestation.to ?? 'fin'}.pdf`,
        );
    } catch (error) {
        sendError(res, error, 'Emargement attestation export failed');
    }
}

/** Récapitulatif d'assiduité d'un groupe (session entière, période optionnelle). */
export async function exportGroupPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        const from = queryString(req.query.from);
        const to = queryString(req.query.to);
        const summary = await service.groupSummary(String(req.params.sessionId), {
            from: from && isIsoDate(from) ? from : undefined,
            to: to && isIsoDate(to) ? to : undefined,
        });
        const pdf = await renderer.groupPdf(summary, parsePdfTheme(req.query.theme));
        sendFile(
            res,
            pdf,
            'application/pdf',
            `assiduite-groupe-${fileSlug(summary.sessionNom)}-${summary.from ?? 'debut'}-${summary.to ?? 'fin'}.pdf`,
        );
    } catch (error) {
        sendError(res, error, 'Emargement group PDF export failed');
    }
}

// ── Assiduité (7.1 / 7.2) ────────────────────────────────────────────────────

/** Agrégats d'assiduité : par alternant, par session et par site, sur une période. */
export async function assiduite(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ assiduite: await service.assiduite(assiduiteFilter(req)) });
    } catch (error) {
        sendError(res, error, 'Emargement assiduite failed');
    }
}

/** Assiduité d'un alternant : synthèse et détail séance par séance. */
export async function assiduiteAlternant(req: AuthRequest, res: Response): Promise<void> {
    try {
        const from = queryString(req.query.from);
        const to = queryString(req.query.to);
        res.json({
            assiduite: await service.assiduiteAlternant(String(req.params.alternantId), {
                from: from && isIsoDate(from) ? from : undefined,
                to: to && isIsoDate(to) ? to : undefined,
            }),
        });
    } catch (error) {
        sendError(res, error, 'Emargement alternant assiduite failed');
    }
}

// ── Côté formateur (lien public) ─────────────────────────────────────────────

export async function formateurView(req: Request, res: Response): Promise<void> {
    try {
        res.json({ emargement: await service.formateurView(String(req.params.token)) });
    } catch (error) {
        sendError(res, error, 'Emargement formateur view failed');
    }
}

export async function setAttendance(req: Request, res: Response): Promise<void> {
    try {
        const attendance = await service.setAttendance(String(req.params.token), req.body, clientMeta(req));
        res.json({ attendance });
    } catch (error) {
        sendError(res, error, 'Emargement attendance failed');
    }
}

export async function signAttendanceManually(req: Request, res: Response): Promise<void> {
    try {
        const attendance = await service.signAttendanceManually(String(req.params.token), req.body, clientMeta(req));
        res.json({ attendance });
    } catch (error) {
        sendError(res, error, 'Emargement handwritten signature failed');
    }
}

export async function signSheet(req: Request, res: Response): Promise<void> {
    try {
        res.json(await service.signSheet(String(req.params.token), req.body, clientMeta(req)));
    } catch (error) {
        sendError(res, error, 'Emargement signature failed');
    }
}

// ── Côté alternant (QR code) ─────────────────────────────────────────────────

export async function publicSigning(req: Request, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.publicSigning(String(req.params.token)) });
    } catch (error) {
        sendError(res, error, 'Emargement public page failed');
    }
}

export async function signByQr(req: Request, res: Response): Promise<void> {
    try {
        res.json({ result: await service.signByQr(String(req.params.token), req.body, clientMeta(req)) });
    } catch (error) {
        sendError(res, error, 'Emargement QR signature failed');
    }
}
