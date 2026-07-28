import { randomUUID } from 'crypto';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
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
import { logger } from '../external/logger';
import { PDFDocument } from 'pdf-lib';

/**
 * Nombre de pages d'un PDF. Min 1.
 * pdf-lib lit la structure réelle du document : fiable même quand Puppeteer
 * compresse les objets en `object streams` (où `/Type /Page` n'apparaît pas en
 * clair, ce qui faisait échouer l'ancien comptage par regex).
 */
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

    async findById(id: string): Promise<NeedsAnalysisGql | null> {
        const doc = await this.repository.findById(id);
        return doc ? toNeedsAnalysis(doc) : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysisGql[]> {
        const docs = await this.repository.findByCompanyId(companyId);
        return docs.map(toNeedsAnalysis);
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
        });

        // Archivage Drive du PDF non signé, dans le dossier du secteur du commercial.
        // Best-effort : n'échoue pas l'envoi en signature.
        await abDriveConfigService.archiveAbPdf(
            analysis.salerInfo?.id ?? undefined,
            'UNSIGNED',
            buffer,
            filename,
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
        const positionsLabel = `${offerCount} poste${offerCount > 1 ? 's' : ''}`;
        const firstOfferId = offers[0]?._id;
        await Promise.all(
            rhUsers.map((user) =>
                this.notificationService.create({
                    userId: user.id,
                    type: 'ab_ready_for_matching',
                    category: 'company',
                    level: 'info',
                    title: 'Nouvelle analyse du besoin à matcher',
                    message: `${companyName} — ${positionsLabel} à pourvoir`,
                    link: firstOfferId ? `/rh/matching?offer=${firstOfferId}` : '/rh/matching',
                }),
            ),
        );
        logger.info({ id: analysisId, recipients: rhUsers.length }, '[NeedsAnalysis] RH notified');

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
        // Hors du chemin critique : un échec ne doit pas empêcher la suppression de l'AB.
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

        return this.repository.delete(id);
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
