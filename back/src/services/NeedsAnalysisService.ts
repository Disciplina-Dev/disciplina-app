import { randomUUID } from 'crypto';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';
import { NeedsAnalysis } from '../types/needsAnalysis.types';
import { NeedsAnalysisStatus } from '../types/needsAnalysisNoSql.types';
import { toNeedsAnalysis, toNeedsAnalysisDocument, mergeOfferIdentity } from './mappers/needsAnalysis.mapper';
import { CompaniesService } from './CompaniesService';
import { PdfService } from './PdfService';
import { DocuSealService } from '../external/docuseal/docuseal.service';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { TodoService } from './TodoService';
import { Role } from '../types/user.types';
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

export class NeedsAnalysisService {
    private repository: NeedsAnalysisRepository;
    private companiesService: CompaniesService;
    private docusealService: DocuSealService;
    private userRepository: UserRepository;
    private notificationService: NotificationService;
    private todoService: TodoService;

    constructor() {
        this.repository = new NeedsAnalysisRepository();
        this.companiesService = new CompaniesService();
        this.docusealService = new DocuSealService();
        this.userRepository = new UserRepository();
        this.notificationService = new NotificationService();
        this.todoService = new TodoService();
    }

    async findAll(): Promise<NeedsAnalysis[]> {
        const docs = await this.repository.findAll();
        return docs.map(toNeedsAnalysis);
    }

    async findById(id: string): Promise<NeedsAnalysis | null> {
        const doc = await this.repository.findById(id);
        return doc ? toNeedsAnalysis(doc) : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        const docs = await this.repository.findByCompanyId(companyId);
        return docs.map(toNeedsAnalysis);
    }

    async create(data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        logger.info(
            { companyID: data.companyID, userID: data.userID, jobTitle: data.jobTitle },
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
        const document = toNeedsAnalysisDocument({ ...data, id, status: 'BROUILLON' }, company, saler);
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
        const company = await this.companiesService.findById(analysis.companyID);
        if (!company) {
            throw new Error(`Company with ID ${analysis.companyID} not found`);
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
    async sendForSignature(id: string): Promise<NeedsAnalysis> {
        const doc = await this.repository.findById(id);
        if (!doc) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(doc);

        const signerEmail = analysis.recruitmentResponsibleEmail;
        if (!signerEmail) {
            throw new Error('No recruitment responsible email to send the signature request to');
        }

        const company = await this.companiesService.findById(analysis.companyID);
        if (!company) {
            throw new Error(`Company with ID ${analysis.companyID} not found`);
        }

        const buffer = await PdfService.generateNeedsAnalysisPdf(analysis, company);
        const filename = `Analyse_Besoin_${company.name?.replace(/\s+/g, '_') || 'Entreprise'}_${id}.pdf`;

        const [firstName, ...rest] = (analysis.recruitmentResponsibleName ?? '').trim().split(/\s+/);
        const lastName = rest.join(' ');

        const submissionId = await this.docusealService.initiateSignatureProcedure(
            buffer,
            filename,
            signerEmail,
            firstName || 'Responsable',
            lastName || 'Recrutement',
            await countPdfPages(buffer),
        );

        const wasDraft = doc.status === NeedsAnalysisStatus.BROUILLON;

        await this.repository.update(id, {
            status: NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            signature_request_id: submissionId,
        });

        // Au premier envoi : créer les offres de matching et notifier les RH.
        // Hors du chemin critique de signature : on log mais on ne fait pas échouer l'envoi.
        if (wasDraft) {
            await this.createMatchingJobsAndNotifyRh(analysis, company.name || 'Entreprise').catch((err) => {
                logger.error({ err, id }, '[NeedsAnalysis] Failed to create matching jobs / notify RH');
            });
        }

        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    /** Initialise le matching sur les offres de l'AB et notifie tous les RH (cloche CRM). */
    private async createMatchingJobsAndNotifyRh(analysis: NeedsAnalysis, companyName: string): Promise<void> {
        await this.repository.initializeOfferMatching(analysis.id);
        const abDoc = await this.repository.findById(analysis.id);
        const offerCount = abDoc?.offers?.length ?? 0;
        logger.info({ id: analysis.id, count: offerCount }, '[NeedsAnalysis] Offer matching initialized for AB');

        // RH + Responsables + Admin : tous ont accès à l'espace de matching.
        const rhUsers = (await this.userRepository.findByRoles([Role.RH, Role.RESPONSABLE, Role.ADMIN])) ?? [];
        const positionsLabel = `${offerCount} poste${offerCount > 1 ? 's' : ''}`;
        await Promise.all(
            rhUsers.map((user) =>
                this.notificationService.create({
                    userId: user.id,
                    type: 'ab_ready_for_matching',
                    level: 'info',
                    title: 'Nouvelle analyse du besoin à matcher',
                    message: `${companyName} — ${positionsLabel} à pourvoir`,
                    link: '/rh/matching',
                }),
            ),
        );
        logger.info({ id: analysis.id, recipients: rhUsers.length }, '[NeedsAnalysis] RH notified');

        // Responsables only: create an actionable todo
        const responsables = rhUsers.filter((u) => u.role === Role.RESPONSABLE);
        await Promise.all(
            responsables.map((user) =>
                this.todoService.createSystemTodo(
                    user.id,
                    `AB à traiter — ${companyName} (${positionsLabel})`,
                    `ab:${analysis.id}`,
                ),
            ),
        );
    }

    async update(id: string, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        if (!id) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }
        const merged = { ...toNeedsAnalysis(existing), ...data, id };
        const company = await this.companiesService.findById(merged.companyID);
        if (!company) {
            throw new Error(`Company with ID ${merged.companyID} not found`);
        }
        const saler = merged.userID ? await this.userRepository.findById(merged.userID) : null;
        const document = toNeedsAnalysisDocument(merged, company, saler);
        document.offers = (document.offers ?? []).map((offer, index) =>
            mergeOfferIdentity(existing.offers?.[index], offer),
        );
        const updated = await this.repository.update(id, document);
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
        // Hors du chemin critique : un échec ne doit pas empêcher la suppression de l'AB.
        try {
            const removed = await this.repository.clearOffersByNeedsAnalysisId(id);
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

    private validateData(data: Partial<NeedsAnalysis>): void {
        if (!data.companyID) {
            throw new Error('Company ID is required');
        }
        if (!data.userID) {
            throw new Error('User ID is required');
        }
        if (!data.jobTitle && !data.positions?.[0]?.jobTitle) {
            throw new Error('Job title is required');
        }
    }
}
