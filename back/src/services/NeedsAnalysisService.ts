import { randomUUID } from 'crypto';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { OfferAbFilter, AbStatus } from '../types/offer.types';
import {
    NeedsAnalysis as NeedsAnalysisNoSql,
    NeedsAnalysisWriteInput,
    NeedsAnalysisStatus,
} from '../types/needsAnalysisNoSql.types';
import { toNeedsAnalysis, toNeedsAnalysisDocument, NeedsAnalysisGql } from './mappers/needsAnalysis.mapper';
import { buildOffers, mergeOfferIdentity } from './mappers/offer.mapper';
import { CompaniesService } from './CompaniesService';
import { PdfService } from './PdfService';
import { DocuSealService } from '../external/docuseal/docuseal.service';
import { MailTemplateService } from './MailTemplateService';
import { UserService } from './UserService';
import { GoogleGmailService } from '../external/google/gmail.service';
import { AB_SIGNATURE_SUBJECT, AB_SIGNATURE_BODY } from './abSignatureTemplate';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { TodoService } from './TodoService';
import { JobRole, Permission } from '../types/user.types';
import { abDriveConfigService } from './AbDriveConfigService';
import { sendSystemEmail } from '../external/google/system-mail';
import { env } from '../config/env';
import { logger } from '../external/logger';
import { PDFDocument } from 'pdf-lib';

/**
 * Nombre de pages d'un PDF. Min 1.
 * pdf-lib lit la structure réelle du document : fiable même quand Puppeteer
 * compresse les objets en `object streams` (où `/Type /Page` n'apparaît pas en
 * clair, ce qui faisait échouer l'ancien comptage par regex).
 */
function hasActiveOfferFilter(filter: OfferAbFilter): boolean {
    return Boolean(
        filter.search ||
        filter.statuses?.length ||
        filter.desiredTp?.length ||
        filter.sectors?.length ||
        filter.localisations?.length,
    );
}

// Région de l'AB (NORD/OUEST/SUD) → libellé du secteur des users (Nord-Est/Ouest/Sud).
const REGION_TO_USER_SECTOR: Record<string, string> = {
    NORD: 'Nord-Est',
    OUEST: 'Ouest',
    SUD: 'Sud',
};

/** Vrai si l'utilisateur est rattaché au secteur de l'AB (ou n'a pas de secteur défini). */
function userBelongsToSector(user: { sectors?: string | string[] | null }, region: string | undefined): boolean {
    if (!region) return true;
    const sector = REGION_TO_USER_SECTOR[region];
    if (!sector) return true;
    const raw = user.sectors;
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? (JSON.parse(raw) as string[]) : [];
    return list.length === 0 || list.includes(sector);
}

async function countPdfPages(buffer: Buffer): Promise<number> {
    try {
        const pdf = await PDFDocument.load(buffer);
        return Math.max(1, pdf.getPageCount());
    } catch (err) {
        logger.error({ err }, '[NeedsAnalysis] Failed to count PDF pages, defaulting to 1');
        return 1;
    }
}

/** Échappe le texte injecté dans le HTML d'un mail (nom d'entreprise, etc.). */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class NeedsAnalysisService {
    private repository: NeedsAnalysisRepository;
    private offerRepository: OfferRepository;
    private companiesService: CompaniesService;
    private docusealService: DocuSealService;
    private mailTemplateService: MailTemplateService;
    private userService: UserService;
    private gmailService: GoogleGmailService;
    private userRepository: UserRepository;
    private notificationService: NotificationService;
    private todoService: TodoService;

    constructor() {
        this.repository = new NeedsAnalysisRepository();
        this.offerRepository = new OfferRepository();
        this.companiesService = new CompaniesService();
        this.docusealService = new DocuSealService();
        this.mailTemplateService = new MailTemplateService();
        this.userService = new UserService();
        this.gmailService = new GoogleGmailService();
        this.userRepository = new UserRepository();
        this.notificationService = new NotificationService();
        this.todoService = new TodoService();
    }

    async findAll(): Promise<NeedsAnalysisGql[]> {
        const docs = await this.repository.findAll();
        return docs.map(toNeedsAnalysis);
    }

    async findPage(first: number, after?: string, filter?: OfferAbFilter): Promise<NeedsAnalysisNoSql[]> {
        const hasOfferFilter = Boolean(filter && hasActiveOfferFilter(filter));
        const abStatus = filter?.abStatus;

        // Aucune contrainte : liste brute (la liste « Tous » inclut les AB inactives).
        if (!hasOfferFilter && !abStatus) {
            return this.repository.findPage(first, after);
        }

        // Contrainte par offres (statut, TP, secteur, localisation, recherche…).
        let offerIds: string[] | undefined;
        if (hasOfferFilter) {
            offerIds = await this.offerRepository.findNeedsAnalysisIdsByFilter(filter!);
            if (offerIds.length === 0) return [];
        }

        // Contrainte par statut d'AB dérivé (onglets Actif / Archivé / Inactif).
        let statusIds: string[] | undefined;
        if (abStatus) {
            statusIds = await this.resolveAbStatusIds(abStatus);
            if (statusIds.length === 0) return [];
        }

        // Intersection des deux contraintes, sinon celle présente seule.
        let restrictIds: string[] | undefined;
        if (offerIds && statusIds) {
            const statusSet = new Set(statusIds);
            restrictIds = offerIds.filter((id) => statusSet.has(id));
        } else {
            restrictIds = offerIds ?? statusIds;
        }
        if (restrictIds && restrictIds.length === 0) return [];

        return this.repository.findPage(first, after, restrictIds);
    }

    /**
     * Ids des AB correspondant à l'onglet choisi, hors AB supprimées pour Actif/Archivé.
     * Le statut d'onglet peut être forcé manuellement (`ab_status`) : il prime alors
     * sur le calcul dérivé des offres. Les AB à statut manuel sont exclues du calcul
     * dérivé pour ne jamais apparaître dans deux onglets à la fois.
     */
    private async resolveAbStatusIds(abStatus: AbStatus): Promise<string[]> {
        const deletedIds = await this.repository.findDeletedIds();
        const deletedSet = new Set(deletedIds);

        if (abStatus === 'INACTIVE') {
            const manualInactive = await this.repository.findIdsByManualStatus('INACTIVE');
            return [...new Set([...manualInactive, ...deletedIds])];
        }

        const manualIds = (await this.repository.findIdsByManualStatus(abStatus)).filter((id) => !deletedSet.has(id));
        const manualSet = new Set(await this.repository.findIdsWithManualStatus());

        if (abStatus === 'ARCHIVED') {
            const ids = await this.offerRepository.findNeedsAnalysisIdsByAbStatus('ARCHIVED');
            const derived = ids.filter((id) => !deletedSet.has(id) && !manualSet.has(id));
            return [...new Set([...manualIds, ...derived])];
        }

        // ACTIVE : au moins une offre pas encore en contrat, ou aucune offre du tout
        // (AB en cours de création non encore envoyée en signature).
        const [withOffers, withoutOffers] = await Promise.all([
            this.offerRepository.findNeedsAnalysisIdsByAbStatus('ACTIVE'),
            this.repository.findIdsWithoutOffers(),
        ]);
        const unique = [...new Set([...withOffers, ...withoutOffers])];
        const derived = unique.filter((id) => !deletedSet.has(id) && !manualSet.has(id));
        return [...new Set([...manualIds, ...derived])];
    }

    /**
     * Statut d'onglet effectif d'une AB : INACTIVE si soft-deletée, sinon manuel
     * (`ab_status`) s'il est posé, sinon dérivé des offres (ACTIVE/ARCHIVED).
     */
    async getAbStatus(id: string): Promise<AbStatus> {
        const doc = await this.repository.findById(id);
        if (!doc) {
            throw new Error('Needs analysis not found');
        }
        if (doc.is_deleted) return 'INACTIVE';
        if (doc.ab_status) return doc.ab_status;
        return this.offerRepository.findDerivedAbStatus(id);
    }

    /**
     * Force le statut d'onglet d'une AB (onglets de la liste matching RH). `null`
     * réinitialise le calcul automatique (dérivé des offres / soft delete).
     */
    async setAbStatus(id: string, abStatus: AbStatus | null): Promise<NeedsAnalysisGql> {
        if (!id) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }
        const updated = await this.repository.update(id, { ab_status: abStatus ?? null });
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    async findById(id: string): Promise<NeedsAnalysisGql | null> {
        const doc = await this.repository.findById(id);
        return doc ? toNeedsAnalysis(doc) : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysisGql[]> {
        const docs = await this.repository.findByCompanyId(companyId);
        return docs.map(toNeedsAnalysis);
    }

    async findForDashboard(
        limit: number,
        regions?: string[],
    ): Promise<{
        items: {
            id: string;
            companyName: string | null;
            positionsCount: number;
            createdAt: string | null;
            status: string;
        }[];
        totalCount: number;
    }> {
        const [docs, totalCount] = await Promise.all([
            this.repository.findByStatusNotBrouillon(limit, regions),
            this.repository.countByStatusNotBrouillon(regions),
        ]);
        return {
            items: docs.map((doc) => ({
                id: doc._id!,
                companyName: doc.company_infos?.name ?? null,
                positionsCount: doc.positions?.length ?? 0,
                createdAt: doc.created_at?.toISOString() ?? null,
                status: doc.status ?? 'BROUILLON',
            })),
            totalCount,
        };
    }

    async create(data: Partial<NeedsAnalysisWriteInput>): Promise<NeedsAnalysisGql> {
        logger.info(
            { companyID: data.companyID, userID: data.userID, title: data.positions?.[0]?.title },
            '[NeedsAnalysis] create() called',
        );
        this.validateData(data);

        const company = await this.companiesService.findById(data.companyID!);
        if (!company) {
            logger.error({ companyID: data.companyID }, '[NeedsAnalysis] Company not found');
            throw new Error(`Company with ID ${data.companyID} not found`);
        }

        const saler = data.userID ? await this.userRepository.findById(data.userID) : null;
        const id = randomUUID();
        const document = toNeedsAnalysisDocument(
            { ...data, id, status: NeedsAnalysisStatus.BROUILLON },
            company,
            saler,
        );
        const created = await this.repository.create(document);
        await this.companiesService.setAbId(company.id, id);
        logger.info({ id, status: created.status }, '[NeedsAnalysis] create() complete');
        return toNeedsAnalysis(created);
    }

    // Yousign sending is intentionally not wired up yet: the AB stays BROUILLON
    // and the commercial downloads the PDF instead.
    async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
        const doc = await this.repository.findById(id);
        if (!doc) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(doc);
        const company = await this.companiesService.findById(analysis.companyInfos?.id!);
        if (!company) {
            throw new Error(`Company with ID ${analysis.companyInfos?.id} not found`);
        }
        const buffer = await PdfService.generateNeedsAnalysisPdf(analysis, company);
        const filename = `Analyse_Besoin_${company.name?.replace(/\s+/g, '_') || 'Entreprise'}_${id}.pdf`;
        return { buffer, filename };
    }

    /**
     * Génère l'AB en PDF et l'envoie en signature électronique via DocuSeal au
     * responsable recrutement. Passe le statut à EN_ATTENTE_SIGNATURE et stocke
     * l'identifiant de submission.
     */
    async sendForSignature(
        id: string,
        actingUserId: number,
        emailOverride?: { subject?: string; body?: string },
    ): Promise<NeedsAnalysisGql> {
        const doc = await this.repository.findById(id);
        if (!doc) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(doc);

        const signerEmail = analysis.referents?.recruitmentReferents?.email;
        if (!signerEmail) {
            throw new Error('No recruitment responsible email to send the signature request to');
        }

        // L'app envoie elle-même le mail via le Gmail du commercial : son compte
        // Google doit être connecté (comme pour /api/email/send).
        const actingUser = await this.userService.findById(actingUserId);
        if (!actingUser?.oauthToken) {
            throw new Error('Google account not connected');
        }

        const company = await this.companiesService.findById(analysis.companyInfos?.id!);
        if (!company) {
            throw new Error(`Company with ID ${analysis.companyInfos?.id} not found`);
        }

        const buffer = await PdfService.generateNeedsAnalysisPdf(analysis, company);
        const filename = `Analyse_Besoin_${company.name?.replace(/\s+/g, '_') || 'Entreprise'}_${id}.pdf`;

        const [firstName, ...rest] = (analysis.referents?.recruitmentReferents?.name ?? '').trim().split(/\s+/);
        const lastName = rest.join(' ');

        // 1. Créer la procédure DocuSeal SANS envoi d'email → on récupère le lien.
        const { submissionId, signUrl } = await this.docusealService.initiateSignatureProcedure(
            buffer,
            filename,
            signerEmail,
            firstName || 'Responsable',
            lastName || 'Recrutement',
            await countPdfPages(buffer),
        );

        if (!signUrl) {
            throw new Error('DocuSeal did not return a signing link; cannot send the signature email');
        }

        // 2. Envoyer notre mail (Gmail du commercial) avec le lien de signature.
        const { subject, body } = await this.buildSignatureEmail(
            actingUserId,
            emailOverride,
            company.name || 'votre entreprise',
            signUrl,
        );
        await this.gmailService.sendEmail(
            { access_token: actingUser.oauthToken, refresh_token: actingUser.refreshToken ?? undefined },
            { to: signerEmail, subject, html: body, text: body.replace(/<[^>]*>/g, '') },
            this.userService.googleTokenPersister(actingUser.id),
        );

        const wasDraft = doc.status === NeedsAnalysisStatus.BROUILLON;

        await this.repository.update(id, {
            status: NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            signature_request_id: submissionId,
            // Point de départ de la relance auto : une re-sélection manuelle
            // repart de zéro (la relance ne doit intervenir que 2 semaines après
            // le dernier envoi). last_relance_at est conservé tel quel.
            signature_sent_at: new Date(),
            signature_url: signUrl,
        });

        // Archivage Drive du PDF non signé, dans le dossier du secteur de l'AB
        // (région de l'entreprise), pas celui du commercial.
        // Best-effort : n'échoue pas l'envoi en signature.
        await abDriveConfigService.archiveAbPdf(
            analysis.companyInfos?.sector,
            'UNSIGNED',
            buffer,
            filename,
            analysis.salerInfo?.id ?? undefined,
            actingUserId,
        );

        // Au premier envoi : créer les offres de matching et notifier les RH.
        // Hors du chemin critique de signature : on log mais on ne fait pas échouer l'envoi.
        if (wasDraft) {
            await this.createOffersAndNotifyRh(doc, analysis.id, company.name || 'Entreprise').catch((err) => {
                logger.error({ err, id }, '[NeedsAnalysis] Failed to create offers / notify RH');
            });
        }

        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    /**
     * Construit le mail « AB à signer » à partir de l'override (édité dans l'aperçu),
     * sinon du modèle système `ab_signature`, sinon du modèle par défaut. Remplace
     * les variables : {{entreprise}}, {{lien_signature}} (bouton), {{signature}}.
     */
    private async buildSignatureEmail(
        userId: number,
        override: { subject?: string; body?: string } | undefined,
        companyName: string,
        signUrl: string,
    ): Promise<{ subject: string; body: string }> {
        let subject: string;
        let body: string;
        if (override?.body != null) {
            subject = override.subject ?? AB_SIGNATURE_SUBJECT;
            body = override.body;
        } else {
            const tpl = await this.mailTemplateService.findCommercialTemplateByKind('ab_signature');
            subject = tpl?.subject ?? AB_SIGNATURE_SUBJECT;
            body = tpl?.body ?? AB_SIGNATURE_BODY;
        }

        const signatureHtml = await this.mailTemplateService.getSignatureHtml(userId, 'commercial').catch(() => '');
        const button =
            `<a href="${signUrl}" style="display:inline-block;background:#2563eb;color:#fff;` +
            `padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Signer les documents</a>`;

        const fillVars = (text: string, allowLink: boolean): string => {
            let out = text
                .replaceAll('{{entreprise}}', escapeHtml(companyName))
                .replaceAll('{{signature}}', allowLink ? signatureHtml : '');
            out = allowLink ? out.replaceAll('{{lien_signature}}', button) : out.replaceAll('{{lien_signature}}', '');
            return out;
        };

        body = fillVars(body, true);
        // Sécurité : le signataire doit toujours avoir le lien, même si le modèle
        // édité a supprimé {{lien_signature}}.
        if (!body.includes(signUrl)) {
            body += `<p>${button}</p>`;
        }
        subject = fillVars(subject, false);
        return { subject, body };
    }

    /**
     * Aperçu (avant envoi) du mail « AB à signer » : renvoie le modèle brut (avec
     * variables) + les valeurs pour que le front affiche un rendu substitué.
     */
    async getSignatureEmailPreview(abId?: string): Promise<{
        templateId: string | null;
        templateName: string | null;
        subject: string;
        body: string;
        variables: Record<string, string>;
    }> {
        const tpl = await this.mailTemplateService.findCommercialTemplateByKind('ab_signature');
        let entreprise = '';
        if (abId) {
            const doc = await this.repository.findById(abId);
            if (doc) {
                const analysis = toNeedsAnalysis(doc);
                const company = analysis.companyInfos?.id
                    ? await this.companiesService.findById(analysis.companyInfos.id)
                    : null;
                entreprise = company?.name ?? '';
            }
        }
        return {
            templateId: tpl?.id ?? null,
            templateName: tpl?.name ?? null,
            subject: tpl?.subject ?? AB_SIGNATURE_SUBJECT,
            body: tpl?.body ?? AB_SIGNATURE_BODY,
            variables: { entreprise },
        };
    }

    /** Crée les offres de matching (collection `offers`) pour l'AB et notifie tous les RH (cloche CRM). */
    private async createOffersAndNotifyRh(
        doc: NeedsAnalysisNoSql,
        analysisId: string,
        companyName: string,
    ): Promise<void> {
        const offers = await this.offerRepository.createMany(buildOffers(doc));
        const offerCount = offers.length;
        logger.info({ id: analysisId, count: offerCount }, '[NeedsAnalysis] Offers created for AB');

        // RH + Responsables + Admin : tous ont accès à l'espace de matching.
        const rhUsers = (await this.userRepository.findByRoleIds([2, 4, 5])) ?? [];
        const onlyRhUsers = rhUsers.filter((u) => u.role_name === JobRole.RH);
        const positionsLabel = `${offerCount} poste${offerCount > 1 ? 's' : ''}`;
        await Promise.all(
            rhUsers.map((user) =>
                this.notificationService.create({
                    userId: user.id,
                    type: 'ab_ready_for_matching',
                    category: 'company',
                    level: 'info',
                    title: 'Nouvelle analyse du besoin à matcher',
                    message: `${companyName} — ${positionsLabel} à pourvoir`,
                    link: `/rh/matching?needsAnalysis=${analysisId}`,
                }),
            ),
        );
        logger.info({ id: analysisId, recipients: rhUsers.length }, '[NeedsAnalysis] RH notified');

        // Notifier par email uniquement les RH du secteur de l'AB
        const region = doc.company_infos?.sector;
        const emailRecipients = onlyRhUsers.filter((user) => user.email && userBelongsToSector(user, region));
        const positionsHtml = `${offerCount} poste${offerCount > 1 ? 's' : ''}`;
        await Promise.all(
            emailRecipients.map((user) => {
                const recipientName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                return sendSystemEmail({
                    to: user.email,
                    subject: `Nouvelle Analyse du Besoin — ${companyName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <p>Bonjour${recipientName ? ` ${recipientName}` : ''},</p>
                            <p>Une nouvelle Analyse du Besoin en recrutement a été initiée par l'équipe commerciale.</p>
                            <p><strong>${companyName}</strong> — ${positionsHtml} à pourvoir</p>
                            <p style="margin-top: 20px;">
                                <a href="${env.FRONTEND_BASE_URL}/rh/matching?needsAnalysis=${analysisId}"
                                   style="display: inline-block; background: #1130A7; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                                    Voir les candidats
                                </a>
                            </p>
                            <br />
                            <p style="margin-bottom: 0;">Cordialement,</p>
                            <p style="margin-top: 4px; font-weight: bold; color: #1130A7;">L'équipe Disciplina</p>
                        </div>
                    `,
                    text: `Bonjour${recipientName ? ` ${recipientName}` : ''},\n\nUne nouvelle Analyse du Besoin en recrutement a été initiée par l'équipe commerciale.\n\n${companyName} — ${positionsHtml} à pourvoir\n\nAccéder au matching : ${env.FRONTEND_BASE_URL}/rh/matching?needsAnalysis=${analysisId}\n\nCordialement,\nL'équipe Disciplina`,
                });
            }),
        );
        logger.info({ id: analysisId, recipients: emailRecipients.length }, '[NeedsAnalysis] RH emailed');

        // Responsables + RH: create an actionable todo
        const todoRecipients = rhUsers.filter(
            (u) => u.permission_name === Permission.RESPONSABLE || u.role_name === JobRole.RH,
        );
        await Promise.all(
            todoRecipients.map((user) =>
                this.todoService.createSystemTodo(
                    user.id,
                    `AB à traiter — ${companyName} (${positionsLabel})`,
                    `ab:${analysisId}`,
                ),
            ),
        );
    }

    async update(id: string, data: Partial<NeedsAnalysisWriteInput>): Promise<NeedsAnalysisGql> {
        if (!id) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }

        const companyID = data.companyID ?? existing.company_infos?.id;
        const userID = data.userID ?? existing.saler_info?.id;
        const merged: NeedsAnalysisWriteInput = {
            id,
            companyID,
            userID,
            legalRepFunction: data.legalRepFunction ?? existing.referents?.legal_referents?.function ?? null,
            recruitmentResponsibleName:
                data.recruitmentResponsibleName ?? existing.referents?.recruitment_referents?.name ?? null,
            recruitmentResponsiblePhone:
                data.recruitmentResponsiblePhone ?? existing.referents?.recruitment_referents?.phone ?? null,
            recruitmentResponsibleEmail:
                data.recruitmentResponsibleEmail ?? existing.referents?.recruitment_referents?.email ?? null,
            recruitmentResponsibleFunction:
                data.recruitmentResponsibleFunction ?? existing.referents?.recruitment_referents?.function ?? null,
            companySectors: data.companySectors ?? existing.company_infos?.activities ?? [],
            companyDescription: data.companyDescription ?? existing.company_infos?.description ?? null,
            opco: data.opco ?? existing.company_infos?.opco ?? null,
            referralSource: data.referralSource ?? existing.company_infos?.referral_source ?? null,
            postalCode: data.postalCode ?? existing.company_infos?.postal_code ?? null,
            commune: data.commune ?? existing.company_infos?.commune ?? null,
            positions: data.positions ?? existing.positions ?? [],
            recruitmentMethod: data.recruitmentMethod ?? existing.recruitment_method,
            immersionPeriod: data.immersionPeriod ?? existing.immersion_period,
            trainingDays: data.trainingDays ?? existing.training_days,
            yousignSignatureRequestID: data.yousignSignatureRequestID ?? existing.signature_request_id ?? null,
            status: data.status ?? existing.status,
        };

        if (!companyID) {
            throw new Error(`Company with ID ${companyID} not found`);
        }
        const company = await this.companiesService.findById(companyID);
        if (!company) {
            throw new Error(`Company with ID ${companyID} not found`);
        }
        const saler = userID ? await this.userRepository.findById(userID) : null;
        const document = toNeedsAnalysisDocument(merged, company, saler);
        const updated = await this.repository.update(id, document);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }

        // L'AB n'a d'offres que si elle a déjà été envoyée en signature au moins une
        // fois : dans ce cas, on répercute les changements de poste sur les offres
        // existantes en préservant leur id stable et leur état de matching.
        await this.syncOffers(id, updated);

        return toNeedsAnalysis(updated);
    }

    private async syncOffers(id: string, updated: NeedsAnalysisNoSql): Promise<void> {
        const existingOffers = await this.offerRepository.findByNeedsAnalysisId(id);
        if (existingOffers.length === 0) return;

        const rebuilt = buildOffers(updated);
        const toUpdate = rebuilt
            .slice(0, existingOffers.length)
            .map((offer, index) => mergeOfferIdentity(existingOffers[index], offer));
        const toCreate = rebuilt.slice(existingOffers.length);
        const toDelete = existingOffers.slice(rebuilt.length);

        await Promise.all([
            ...toUpdate.map((offer) => this.offerRepository.updateContent(offer._id!, offer)),
            ...(toCreate.length ? [this.offerRepository.createMany(toCreate)] : []),
            ...toDelete.map((offer) => this.offerRepository.deleteById(offer._id!)),
        ]);
    }

    /**
     * Marque une AB comme signée sans passer par le flux Yousign : cas du candidat
     * ayant trouvé son contrat hors sourcing Disciplina. Crée les offres de matching
     * si elles n'existent pas encore (normalement générées au premier envoi en
     * signature), sans notifier les RH puisque le poste est déjà pourvu.
     */
    async markSigned(id: string): Promise<NeedsAnalysisGql> {
        const doc = await this.repository.findById(id);
        if (!doc) {
            throw new Error('Needs analysis not found');
        }

        const existingOffers = await this.offerRepository.findByNeedsAnalysisId(id);
        if (existingOffers.length === 0) {
            await this.offerRepository.createMany(buildOffers(doc));
        }

        await this.repository.update(id, { status: NeedsAnalysisStatus.SIGNE });

        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    async delete(id: string): Promise<boolean> {
        if (!id) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            // Idempotent : l'AB est déjà absente (double-clic, suppression concurrente,
            // suppression en masse qui rejoue le même id). L'état voulu est atteint →
            // succès, on ne remonte pas d'erreur « not found » à l'utilisateur.
            logger.info({ id }, '[NeedsAnalysis] delete() no-op, already absent');
            return true;
        }

        // Supprime les offres de matching de cette AB.
        // Hors du chemin critique : un échec ne doit pas empêcher la mise en inactif de l'AB.
        try {
            const removed = await this.offerRepository.deleteByNeedsAnalysisId(id);
            logger.info({ id, removed }, '[NeedsAnalysis] offers cleared for AB');
        } catch (err) {
            logger.error({ err, id }, '[NeedsAnalysis] Failed to clear offers for AB');
        }

        // Délie l'entreprise de l'AB supprimée (company.ab_id). Hors chemin critique.
        const companyId = existing.company_infos?.id;
        if (companyId) {
            try {
                await this.companiesService.setAbId(companyId, null);
            } catch (err) {
                logger.error({ err, id }, '[NeedsAnalysis] Failed to clear company.ab_id');
            }
        }

        // Soft delete : l'AB devient inactive (is_deleted) au lieu d'être retirée.
        // Elle reste visible dans l'onglet « Inactif » de la liste matching RH.
        return this.repository.markDeleted(id);
    }

    private validateData(data: Partial<NeedsAnalysisWriteInput>): void {
        if (!data.companyID) {
            throw new Error('Company ID is required');
        }
        if (!data.userID) {
            throw new Error('User ID is required');
        }
        if (!data.positions?.[0]?.title) {
            throw new Error('Job title is required');
        }
    }
}
