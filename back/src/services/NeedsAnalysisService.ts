import { NeedsAnalysisRepository } from '../repositories/mysql/NeedsAnalysisRepository';
import { NeedsAnalysis } from '../types/needsAnalysis.types';
import { toNeedsAnalysis, toNeedsAnalysisRow } from './mappers/needsAnalysis.mapper';
import { CompaniesService } from './CompaniesService';
import { PdfService } from './PdfService';
import { DocuSealService } from '../external/docuseal/docuseal.service';
import { JobRepository } from '../repositories/mongo/JobRepository';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { NotificationService } from './NotificationService';
import { buildJobsFromAb } from './mappers/abToJob';
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
    private jobRepository: JobRepository;
    private userRepository: UserRepository;
    private notificationService: NotificationService;

    constructor() {
        this.repository = new NeedsAnalysisRepository();
        this.companiesService = new CompaniesService();
        this.docusealService = new DocuSealService();
        this.jobRepository = new JobRepository();
        this.userRepository = new UserRepository();
        this.notificationService = new NotificationService();
    }

    async findAll(): Promise<NeedsAnalysis[]> {
        const rows = await this.repository.findAll();
        return rows.map(toNeedsAnalysis);
    }

    async findById(id: number): Promise<NeedsAnalysis | null> {
        const row = await this.repository.findById(id);
        return row ? toNeedsAnalysis(row) : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        const rows = await this.repository.findByCompanyId(companyId);
        return rows.map(toNeedsAnalysis);
    }

    async create(data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        logger.info({ companyID: data.companyID, userID: data.userID, jobTitle: data.jobTitle }, '[NeedsAnalysis] create() called');
        this.validateData(data);

        // 1. Fetch Company details
        const company = await this.companiesService.findById(data.companyID!);
        if (!company) {
            logger.error({ companyID: data.companyID }, '[NeedsAnalysis] Company not found');
            throw new Error(`Company with ID ${data.companyID} not found`);
        }
        logger.info(`[NeedsAnalysis] Company found: ${company.name}`);

        // 2. Map input and create initial Brouillon in DB to get an ID
        // Legacy single-position columns are NOT NULL: mirror the first position into them
        const firstPosition = data.positions?.[0];
        const initialData = {
            ...data,
            ...(firstPosition
                ? {
                      trainingDomain: data.trainingDomain ?? firstPosition.trainingDomain,
                      jobTitle: data.jobTitle ?? firstPosition.jobTitle,
                      selectedMissions: data.selectedMissions ?? firstPosition.selectedMissions,
                      localisation: data.localisation ?? firstPosition.localisation,
                      positionsCount: data.positionsCount ?? data.positions!.length,
                  }
                : {}),
            ageRequirements: data.ageRequirements ?? [],
            status: 'BROUILLON' as const
        };
        const rowData = toNeedsAnalysisRow(initialData);
        const id = await this.repository.create(rowData);
        logger.info({ id }, '[NeedsAnalysis] Brouillon created in DB');

        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created needs analysis');
        }
        logger.info({ id, status: created.status }, '[NeedsAnalysis] create() complete');
        return toNeedsAnalysis(created);
    }

    // Yousign sending is intentionally not wired up yet: the AB stays BROUILLON
    // and the commercial downloads the PDF instead.
    async generatePdf(id: number): Promise<{ buffer: Buffer; filename: string }> {
        const row = await this.repository.findById(id);
        if (!row) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(row);
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
    async sendForSignature(id: number): Promise<NeedsAnalysis> {
        const row = await this.repository.findById(id);
        if (!row) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(row);

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

        const wasDraft = row.status === 'BROUILLON';

        await this.repository.update(id, {
            status: 'EN_ATTENTE_SIGNATURE',
            yousign_signature_request_id: submissionId,
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

    /** Crée une offre de matching par poste et notifie tous les RH (cloche CRM). */
    private async createMatchingJobsAndNotifyRh(analysis: NeedsAnalysis, companyName: string): Promise<void> {
        const jobs = buildJobsFromAb(analysis, companyName);
        await Promise.all(jobs.map((job) => this.jobRepository.create(job)));
        logger.info({ id: analysis.id, count: jobs.length }, '[NeedsAnalysis] Matching jobs created from AB');

        // RH + Responsables + Admin : tous ont accès à l'espace de matching.
        const rhUsers = (await this.userRepository.findByRoles([Role.RH, Role.RESPONSABLE, Role.ADMIN])) ?? [];
        const positionsLabel = `${jobs.length} poste${jobs.length > 1 ? 's' : ''}`;
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
    }

    async update(id: number, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        if (!id || id <= 0) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }
        const rowData = toNeedsAnalysisRow(data);
        await this.repository.update(id, rowData);
        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    async delete(id: number): Promise<boolean> {
        if (!id || id <= 0) {
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
